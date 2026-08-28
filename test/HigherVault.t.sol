// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HigherVault} from "../contracts/HigherVault.sol";

contract MockToken {
    string public name = "HIGHER";
    string public symbol = "HI";
    uint8 public decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) public virtual returns (bool) {
        require(balanceOf[msg.sender] >= amount, "bal");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public virtual returns (bool) {
        require(balanceOf[from] >= amount, "bal");
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        allowance[from][msg.sender] = allowed - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract ReenteringToken is MockToken {
    HigherVault public vault;
    bool public attack;

    function setVault(HigherVault v) external { vault = v; }
    function setAttack(bool v) external { attack = v; }

    function transfer(address to, uint256 amount) public override returns (bool) {
        require(balanceOf[msg.sender] >= amount, "bal");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        if (attack) {
            attack = false;
            try vault.withdraw(1) {} catch {}
        }
        return true;
    }
}

contract HigherVaultTest is Test {
    HigherVault vault;
    MockToken token;
    address deployer = address(this);
    address player = address(0xA11CE);
    address attacker = address(0xB0B);

    function setUp() public {
        vault = new HigherVault();
        token = new MockToken();
        token.mint(address(vault), 1_000 ether);
        vault.setToken(address(token), 18);
        vm.deal(player, 1 ether);
        vm.deal(attacker, 1 ether);
    }

    function test_tokenLocksOnce() public {
        vm.expectRevert("token already locked");
        vault.setToken(address(token), 18);
    }

    function test_strangerCannotSetToken() public {
        HigherVault fresh = new HigherVault();
        MockToken t2 = new MockToken();
        vm.prank(attacker);
        vm.expectRevert("not deployer");
        fresh.setToken(address(t2), 18);
    }

    function _buyIn(address who) internal {
        token.mint(who, 1 ether);
        vm.prank(who);
        token.approve(address(vault), 1 ether);
        vm.prank(who);
        vault.deposit();
    }

    function test_depositMustBeExactFee() public {
        vm.prank(player);
        vm.expectRevert("need 1 token");
        vault.deposit();
    }

    function test_receiveReverts() public {
        vm.expectRevert("use deposit()");
        payable(address(vault)).transfer(0.0001 ether);
    }

    function test_nobodyCanForceEthOut() public {
        _buyIn(player);
        assertEq(address(vault).balance, 0);
        assertEq(token.balanceOf(address(vault)), 1_000 ether + 0.8 ether);

        vm.prank(attacker);
        (bool sent,) = payable(address(vault)).call{value: 1 wei}("");
        assertFalse(sent);
        assertEq(address(vault).balance, 0);
    }

    function test_withdrawSelfOnlyAndCei() public {
        _buyIn(player);

        (bool active,, bool higher, uint8 card, uint256 stack,,) = vault.rounds(player);
        assertTrue(active);
        assertEq(stack, 0);
        card; higher;
        assertEq(vault.tokenBalance(player), 0.8 ether);

        vm.prank(attacker);
        vm.expectRevert("nothing to withdraw");
        vault.withdraw(1);

        uint256 before = token.balanceOf(player);
        vm.prank(player);
        vault.withdraw(0.8 ether);
        assertEq(token.balanceOf(player), before + 0.8 ether);
        assertEq(vault.tokenBalance(player), 0);
    }

    function test_reentrancyOnWithdrawBlocked() public {
        ReenteringToken evil = new ReenteringToken();
        HigherVault v2 = new HigherVault();
        evil.setVault(v2);
        v2.setToken(address(evil), 18);

        address p = address(0xC0FFEE);
        evil.mint(p, 1 ether);
        vm.prank(p);
        evil.approve(address(v2), 1 ether);
        vm.prank(p);
        v2.deposit();

        uint256 before = evil.balanceOf(p);
        evil.setAttack(true);
        vm.prank(p);
        v2.withdraw(0.8 ether);
        assertEq(evil.balanceOf(p), before + 0.8 ether);
        assertEq(v2.tokenBalance(p), 0);
    }

    function test_settleAfterGuessChangesStackOrEndsRound() public {
        _buyIn(player);

        (,,, uint8 card,,,) = vault.rounds(player);
        bool higher = card < 12;
        vm.prank(player);
        vault.guess(higher);

        vm.roll(block.number + 1);
        vault.settle(player);

        (bool active, bool pending,, uint8 next, uint256 stack,,) = vault.rounds(player);
        assertFalse(pending);
        if (higher ? next > card : next < card) {
            assertTrue(active);
            assertEq(stack, 1);
            uint256 before = token.balanceOf(player);
            vm.prank(player);
            vault.withdraw(0.8 ether);
            assertEq(token.balanceOf(player), before + 0.8 ether);
            assertEq(vault.tokenBalance(player), 0);
        } else {
            assertFalse(active);
            assertEq(stack, 0);
            assertEq(vault.tokenBalance(player), 0);
            vm.prank(player);
            vm.expectRevert("nothing to withdraw");
            vault.withdraw(1);
        }
        assertEq(address(vault).balance, 0);
    }

    function test_withdrawPointsAmountLeavesRestInVault() public {
        _buyIn(player);
        uint256 vaultBefore = token.balanceOf(address(vault));
        uint256 paid = 0.1 ether; // 3 points
        vm.prank(player);
        vault.withdraw(paid);
        assertEq(token.balanceOf(player), paid);
        assertEq(vault.tokenBalance(player), 0);
        assertEq(token.balanceOf(address(vault)), vaultBefore - paid);
    }

    function test_loseKeepsBagInVault() public {
        _buyIn(player);
        uint256 vaultBefore = token.balanceOf(address(vault));
        vm.prank(player);
        vault.lose();
        assertEq(vault.tokenBalance(player), 0);
        assertEq(token.balanceOf(address(vault)), vaultBefore);
        (bool active,,,, uint256 stack,,) = vault.rounds(player);
        assertFalse(active);
        assertEq(stack, 0);
        vm.prank(player);
        vm.expectRevert("nothing to withdraw");
        vault.withdraw(1);
    }
}
