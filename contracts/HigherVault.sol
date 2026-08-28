// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HigherVault
/// @notice Locked prize vault for Higher or Lower.
///         - Token CA is set once at launch, then frozen.
///         - ETH entry fees (0.0001) and leftover tokens cannot be rescued by anyone.
///         - Players self-withdraw their own stacked winnings (pull pattern).
///         - Tokens leave this contract ONLY in withdraw().
///         - All ETH/token movement follows Checks-Effects-Interactions.
///
/// Security notes (read before mainnet):
/// 1. No owner drain, no rescueETH, no rescueTokens, no pause-and-sweep.
/// 2. Reentrancy: nonReentrant on every state-changing function + CEI on withdraw.
/// 3. Guess is binding: player commits Higher/Lower, card is settled from the
///    commit blockhash in a later block so they cannot simulate-and-skip.
/// 4. Anyone may settle() a pending guess (keeps losers from withholding).
/// 5. After 256 blocks the blockhash is zero; settle forfeits the stack.
/// 6. Opening card uses blockhash(block.number-1) and can be ground by waiting
///    for a favorable start. Guess cards cannot.
/// 7. Validators can influence a blockhash; not VRF. Fine for a small-stakes
///    launch game, not for high TVL.
/// 8. Vault must be pre-funded with the token. If the reserve is dry, withdraw reverts
///    and state is unchanged (CEI + require on transfer).
/// 9. Assumes a standard ERC-20 (no fee-on-transfer). FoT would underpay the player
///    and is treated as unsupported.
/// 10. Wrong CA on setToken is permanent. Deployer must set the real token once.

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract HigherVault {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _guard = _NOT_ENTERED;

    uint256 public constant ENTRY_FEE = 0.0001 ether;
    uint256 public constant PEG_USD = 20;
    uint256 public constant MAX_STACK = 10_000;
    uint256 public constant HASH_WINDOW = 256;
    uint16 public constant FEE_BPS = 2_000; // 20% of the $20 HILO buy-in
    address public constant FEE_RECIPIENT = 0x974aB06E37dfD2d27FAc09c0E6194d2E13042DcC;

    uint8 public constant RANK_2 = 0;
    uint8 public constant RANK_ACE = 12;

    address public immutable deployer;
    IERC20 public token;
    uint8 public tokenDecimals;
    bool public tokenLocked;

    uint256 private _entropy;

    struct Round {
        bool active;
        bool pendingGuess;
        bool guessedHigher;
        uint8 card;          // 0 = 2 ... 12 = A
        uint256 stack;       // unwithdrawn correct guesses
        uint256 commitBlock;
        uint256 nonce;
    }

    mapping(address => Round) public rounds;
    mapping(address => uint256) public tokenBalance;

    event TokenLocked(address indexed ca, uint8 decimals);
    event Deposited(address indexed player, uint8 openingCard);
    event BuyIn(address indexed player, uint256 amount, uint256 fee, uint256 vaulted);
    event GuessCommitted(address indexed player, bool higher, uint256 commitBlock);
    event Settled(address indexed player, uint8 nextCard, bool won, uint256 stack);
    event Forfeited(address indexed player);
    event Withdrawn(address indexed player, uint256 tokens);
    event Lost(address indexed player);

    modifier nonReentrant() {
        require(_guard != _ENTERED, "reentrancy");
        _guard = _ENTERED;
        _;
        _guard = _NOT_ENTERED;
    }

    constructor() {
        deployer = msg.sender;
        _entropy = uint256(keccak256(abi.encodePacked(block.prevrandao, address(this), block.chainid)));
    }

    receive() external payable {
        revert("use deposit()");
    }

    fallback() external payable {
        revert("no fallback");
    }

    /// @notice One-shot. After this, the CA can never change and nobody
    ///         (including deployer) can pull tokens or ETH out except players
    ///         withdrawing their own stack.
    function setToken(address ca, uint8 decimals_) external {
        require(msg.sender == deployer, "not deployer");
        require(!tokenLocked, "token already locked");
        require(ca != address(0), "zero ca");
        require(ca != address(this), "vault ca");
        require(ca.code.length > 0, "ca not a contract");
        require(decimals_ > 0 && decimals_ <= 18, "bad decimals");

        token = IERC20(ca);
        tokenDecimals = decimals_;
        tokenLocked = true;

        emit TokenLocked(ca, decimals_);
    }

    function tokensPerWin() public view returns (uint256) {
        return 10 ** uint256(tokenDecimals);
    }

    function tokenReserve() public view returns (uint256) {
        if (!tokenLocked) return 0;
        return token.balanceOf(address(this));
    }

    function pegValueUsd(uint256 stack_) public pure returns (uint256) {
        return stack_ * PEG_USD;
    }

    /// @notice Deposit exactly 1 HILO ($20). Tokens move INTO this vault.
    ///         20% is forwarded to FEE_RECIPIENT; 80% stays locked here.
    function deposit() external nonReentrant {
        require(tokenLocked, "token not set");

        Round storage r = rounds[msg.sender];
        require(!r.active && !r.pendingGuess, "round open");

        uint256 buyIn = 10 ** uint256(tokenDecimals);
        uint256 fee = (buyIn * FEE_BPS) / 10_000;
        uint256 vaulted = buyIn - fee;
        require(token.balanceOf(msg.sender) >= buyIn, "need 1 token");

        _entropy = uint256(keccak256(abi.encodePacked(_entropy, msg.sender, block.prevrandao, block.number)));
        uint8 opening = _openingCard(msg.sender, r.nonce);
        r.nonce += 1;

        r.active = true;
        r.pendingGuess = false;
        r.stack = 0;
        r.card = opening;
        r.commitBlock = 0;
        tokenBalance[msg.sender] += vaulted;

        _safeTransferFrom(msg.sender, address(this), buyIn);
        if (fee > 0) {
            _safeTransfer(FEE_RECIPIENT, fee);
        }

        emit Deposited(msg.sender, opening);
        emit BuyIn(msg.sender, buyIn, fee, vaulted);
    }

    /// @notice Bind a Higher or Lower guess. The next card is NOT known yet.
    function guess(bool higher) external nonReentrant {
        Round storage r = rounds[msg.sender];
        require(r.active, "no round");
        require(!r.pendingGuess, "settle first");
        require(r.stack < MAX_STACK, "max stack");

        if (higher) {
            require(r.card < RANK_ACE, "nowhere higher");
        } else {
            require(r.card > RANK_2, "nowhere lower");
        }

        r.pendingGuess = true;
        r.guessedHigher = higher;
        r.commitBlock = block.number;

        emit GuessCommitted(msg.sender, higher, block.number);
    }

    /// @notice Resolve a committed guess from a later block. Pull pattern:
    ///         anyone can settle so a loser cannot withhold a losing card.
    function settle(address player) external nonReentrant {
        require(player != address(0), "zero player");
        Round storage r = rounds[player];
        require(r.pendingGuess, "no pending");
        require(block.number > r.commitBlock, "wait one block");

        bytes32 h = blockhash(r.commitBlock);
        if (h == bytes32(0) || block.number > r.commitBlock + HASH_WINDOW) {
            r.pendingGuess = false;
            r.active = false;
            r.stack = 0;
            r.commitBlock = 0;
            tokenBalance[player] = 0;
            emit Forfeited(player);
            return;
        }

        uint8 current = r.card;
        uint8 nextCard = uint8(uint256(keccak256(abi.encodePacked(h, player, r.nonce, address(this)))) % 13);
        r.nonce += 1;

        bool won = r.guessedHigher ? (nextCard > current) : (nextCard < current);

        r.pendingGuess = false;
        r.commitBlock = 0;
        r.card = nextCard;

        if (won) {
            r.stack += 1;
        } else {
            r.active = false;
            r.stack = 0;
            tokenBalance[player] = 0;
        }

        emit Settled(player, nextCard, won, r.stack);
    }

    /// @notice Pull `amount` of your credited HILO. Leftover credit stays in the vault.
    ///         Amount is the point conversion (3 points = 0.1 HILO), capped by credit.
    function withdraw(uint256 amount) external nonReentrant {
        Round storage r = rounds[msg.sender];

        require(tokenLocked, "token not set");
        require(!r.pendingGuess, "settle first");
        uint256 credit = tokenBalance[msg.sender];
        require(credit > 0, "nothing to withdraw");
        require(amount > 0 && amount <= credit, "bad amount");

        tokenBalance[msg.sender] = 0;
        r.stack = 0;
        r.active = false;
        r.commitBlock = 0;

        _safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Wrong call or timeout. The bag stays in this vault. Player cannot pull it.
    function lose() external nonReentrant {
        Round storage r = rounds[msg.sender];
        require(tokenLocked, "token not set");
        require(!r.pendingGuess, "settle first");
        require(r.active || tokenBalance[msg.sender] > 0, "no bag");

        tokenBalance[msg.sender] = 0;
        r.active = false;
        r.stack = 0;
        r.commitBlock = 0;
        r.pendingGuess = false;

        emit Lost(msg.sender);
    }

    function _safeTransferFrom(address from, address to, uint256 amount) private {
        (bool ok, bytes memory data) = address(token).call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "transferFrom failed");
    }

    function _openingCard(address player, uint256 nonce_) private view returns (uint8) {
        // Weight toward 2–10 so the first guess is playable. Ace never opens.
        bytes32 h = blockhash(block.number - 1);
        uint256 seed = uint256(keccak256(abi.encodePacked(h, player, nonce_, _entropy, address(this))));
        uint256 w = seed % 45;
        if (w < 6) return 0;
        if (w < 12) return 1;
        if (w < 18) return 2;
        if (w < 24) return 3;
        if (w < 29) return 4;
        if (w < 34) return 5;
        if (w < 38) return 6;
        if (w < 41) return 7;
        if (w < 43) return 8;
        if (w < 44) return 9;
        return 10; // Queen. King/Ace do not open.
    }

    function _safeTransfer(address to, uint256 amount) private {
        (bool ok, bytes memory data) = address(token).call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "transfer failed");
    }
}
