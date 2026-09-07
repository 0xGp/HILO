# HILO Whitepaper

**Higher / Lower · On-Chain Vaulted Play**  
Version 1.0 · Robinhood Chain Testnet  
Confidential · For distribution with the HILO product

---

## Abstract

HILO is a higher-or-lower card game with vaulted buy-ins, a fixed match clock, and a committed shoe. Players deposit **1 HILO** ($20 peg) into a non-custodial vault, receive **20 HP**, and call whether the next rank is higher or lower than the card on the table. Outcomes settle against a **HMAC-SHA256** shuffled deck committed before the call. Value leaves the vault only when the player extracts; a wipe keeps the bag in the house.

HILO shows a concrete path for consumer games on L2-style chains: simple rules, transparent economics, and on-chain custody for deposits and cash-outs—without turning the table into a casino black box.

---

## 1. Problem

Most on-chain games fail one of three tests:

1. **Opacity** — RNG is opaque or easily gamed; players cannot verify the shoe.
2. **Custody risk** — “House” contracts can drain, pause, or re-route funds.
3. **Friction** — Multi-step approvals, unclear fees, and long sessions kill casual play.

Web3 still needs **readable** games: one buy-in, one loop, rules in the open, and money that only moves when the player says so.

---

## 2. What HILO Is

HILO is a **single-loop table game**:

| Step | Action |
|------|--------|
| Buy-in | Deposit **1 HILO** → 20% treasury fee, **80% vaulted** → spawn **20 HP** |
| Call | Higher or lower vs the live rank · **20-second** match clock |
| Score | Hit **+3 HP** · Miss **−3 HP** · **0 HP = wipe** |
| Extract | **3 HP = 0.1 HILO** withdrawn from vault credit |

Edge cases are explicit: Ace has no higher; Two has no lower. Same-rank draws count as a miss.

The product narrative is intentional: *call the higher / lower / faster / deeper rank*—through committed shoes and vaulted buy-ins.

---

## 3. How It Works

### 3.1 Token & peg

- **HILO** — ERC-20, 18 decimals, symbol `HILO`
- Documented peg: **$20 per HILO**
- Entry: **1 HILO** per match

### 3.2 Vault split

On `deposit()`:

- **0.2 HILO (20%)** → fee / treasury recipient  
- **0.8 HILO (80%)** → player vault credit  

The vault does not expose an owner drain path for player credit. Funds exit via player `withdraw` (extract) or forfeit into the vault on wipe (`lose`).

### 3.3 Match loop

1. Wallet connects on **Robinhood Chain Testnet** (chain ID `46630`).
2. Approve + deposit (batched when the wallet supports it).
3. Client opens an HMAC shoe and starts the **20s** clock.
4. Player calls Higher / Lower; HP updates.
5. Time-up with HP → bank (extract) or rebuy.  
   Wipe at 0 → rebuy only; credit stays vaulted.

### 3.4 Fairness model (shoe)

Before play, the client:

1. Harvests entropy (CSPRNG + session context).
2. Publishes a **commitment**: `SHA-256("HILO.commit.v1" ‖ seed)`.
3. Shuffles a 52-card deck with Fisher–Yates using  
   `HMAC-SHA256(seed, "HILO.u32.v1" ‖ …)` and rejection sampling.
4. Verifies commitment and deck integrity before / during calls.

Players are told—and the client enforces—that the next rank is not a naked `Math.random()` roll.

> **Scope note:** Live UI play uses the client HMAC shoe plus vault deposit / withdraw / lose. The Solidity vault also contains an alternate on-chain guess/settle path (blockhash-based) for contract tests; treat that as a parallel layer until the frontend wires those calls.

---

## 4. Benefit to the Web3 Ecosystem

### 4.1 Proof of readable consumer UX

HILO compresses on-chain play into one mental model: **deposit → call → extract**. That pattern is reusable for other casual games on emerging chains (including Robinhood Chain), where first-time wallet users need clarity more than complexity.

### 4.2 Transparent fee surface

A fixed **20% / 80%** split at buy-in is auditable in constants and contracts. No hidden rake mid-hand. Ecosystem builders can copy the pattern for entry fees without inventing opaque house edges.

### 4.3 Committed randomness as a teaching tool

HMAC commit-and-shuffle gives a **verifiable narrative** players can understand: seed committed, deck fixed, calls checked. That raises the bar for “provably fair” expectations in web3 gaming—even when parts of the loop remain client-side.

### 4.4 Non-custodial vault discipline

Player credit is vaulted; extract is user-initiated; wipe does not invent a backdoor payout. This models **house risk separation**: treasury fee is explicit; player bag is either withdrawn by the player or forfeited by rule—not silently swept by an admin.

### 4.5 Chain activation

Running on Robinhood Chain Testnet exercises real wallet flows (approve, deposit, withdraw, gas), explorers, and RPC—useful demand for a new chain’s gaming vertical without requiring a full DEX or lending stack first.

### 4.6 Composability of the loop

The economic primitives—entry unit, fee BPS, HP ↔ token conversion, vault credit—are small and portable. Other teams can fork the loop for different skill games while keeping the same custody story.

---

## 5. Token & Contract Map

| Asset | Address (Testnet) |
|-------|-------------------|
| HILO token | `0x19E1BE6480364b81ec0B6E5919c2EfaBe55ABE54` |
| HigherVault | `0xF16d0fFF51DeFfB3A2c3542661183d4A06c7f5Be` |
| Fee recipient | `0x974aB06E37dfD2d27FAc09c0E6194d2E13042DcC` |

| Network | Detail |
|---------|--------|
| Name | Robinhood Chain Testnet |
| Chain ID | `46630` (`0xb616`) |
| RPC | `https://rpc.testnet.chain.robinhood.com` |
| Explorer | `https://explorer.testnet.chain.robinhood.com` |

---

## 6. Economic Parameters

| Parameter | Value |
|-----------|-------|
| Peg | $20 / HILO |
| Buy-in | 1 HILO |
| Treasury fee | 20% (0.2 HILO) |
| Vaulted | 80% (0.8 HILO) |
| Start HP | 20 |
| Hit / miss | ±3 HP |
| Extract rate | 3 HP = 0.1 HILO |
| Match clock | 20 seconds |

Illustrative extract: **20 HP → ~0.666… HILO** (capped by vault credit).

---

## 7. Risk & Limitations

- **Testnet stage** — tokens and vaults are for testing; pegs are product documentation, not exchange guarantees.
- **Client shoe** — commitment is cryptographically structured; full trust minimization for the live shoe still depends on open-source verification and future on-chain wiring of play.
- **Blockhash path** — if/when on-chain guess/settle is used, validators can influence `blockhash`; that path is not VRF.
- **Skill + variance** — Ace/Two constraints and clock pressure create skill; wipe risk remains real.

---

## 8. Roadmap Themes

1. Harden shoe verification UX (publish commit, prove deck end-of-round).
2. Optionally migrate call settlement fully on-chain where gas and UX allow.
3. Mainnet / production tokenomics review after testnet usage data.
4. Expand table variants while keeping the one-loop buy-in / extract story.

---

## 9. Conclusion

HILO is not “DeFi with cards.” It is a **tight consumer game** with vaulted money, committed dealing, and rules a player can read in one screen. For web3, its value is the pattern: **custody you can audit, fees you can see, fairness you can explain, and a loop short enough to finish in twenty seconds.**

---

*HILO · Call the rank · Vault the bag*  
© HILO contributors · Testnet documentation
