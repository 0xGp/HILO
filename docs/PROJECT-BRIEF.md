# HILO — Project Documentation

**2-page brief · Product, mechanics, ecosystem value**  
Robinhood Chain Testnet · v1.0

---

# Page 1 — Product Overview

## What it is

**HILO** is an on-chain higher-or-lower card game. Players deposit **1 HILO** ($20 peg) into a vault, receive **20 HP**, and call whether the next card rank is higher or lower than the card on the table. The match lasts **20 seconds**. Hits add **3 HP**; misses subtract **3 HP**. At **0 HP** the player is wiped and vault credit stays in the house. With HP left, the player can **extract** value from the vault at **3 HP = 0.1 HILO**.

One loop. No side quests.

```
CONNECT → DEPOSIT 1 HILO → CALL HIGHER/LOWER → EXTRACT OR REBUY
```

## Why it exists

Web3 games often hide RNG, bury fees, or let “house” contracts move player money freely. HILO is built to be **readable**:

- Fees are fixed at buy-in (**20% treasury / 80% vaulted**).
- The shoe is **HMAC-SHA256 committed** before calls—not a silent `Math.random()`.
- Cash-out is **player-initiated** withdraw from vault credit.

## Who it’s for

- Wallet users on **Robinhood Chain Testnet** who want a short, high-clarity game session.
- Builders looking for a reference pattern: vaulted entry + committed deal + extract math.
- Ecosystem partners who need a live consumer demo that exercises approve / deposit / withdraw.

## Core rules (quick)

| Rule | Detail |
|------|--------|
| Ranks | 2–10, J, Q, K, A |
| Ace | No higher call |
| Two | No lower call |
| Same rank | Counts as miss |
| Clock | 20s for the whole round |
| Wipe | 0 HP → rebuy only |

## Live contracts (testnet)

| Role | Address |
|------|---------|
| HILO token | `0x19E1BE6480364b81ec0B6E5919c2EfaBe55ABE54` |
| Vault | `0xF16d0fFF51DeFfB3A2c3542661183d4A06c7f5Be` |
| Fee wallet | `0x974aB06E37dfD2d27FAc09c0E6194d2E13042DcC` |

**Network:** Robinhood Chain Testnet · Chain ID `46630`  
**RPC:** `https://rpc.testnet.chain.robinhood.com`  
**Explorer:** `https://explorer.testnet.chain.robinhood.com`

---

# Page 2 — Mechanics, Stack & Ecosystem Benefit

## Economics

| Parameter | Value |
|-----------|-------|
| Peg | $20 / HILO |
| Buy-in | 1 HILO |
| Treasury | 20% (0.2 HILO) |
| Vaulted credit | 80% (0.8 HILO) |
| Start HP | 20 |
| ± per call | 3 HP |
| Extract | 3 HP → 0.1 HILO |
| Example | 20 HP ≈ 0.667 HILO (≤ vault credit) |

## Fairness (shoe)

1. Seed harvested (CSPRNG + session entropy).  
2. Commitment: `SHA-256("HILO.commit.v1" ‖ seed)`.  
3. Deck shuffled with HMAC-SHA256 draws (Fisher–Yates).  
4. Commitment / deck verified around each call.

Landing copy and FAQ state this clearly: *committed before you call*.

## User journeys

**Deposit** — Connect wallet → hold 1 HILO + gas → approve + `vault.deposit()` → 20 HP + shoe + clock.  
**Play** — Higher / Lower → HP update → edge cases enforced in UI.  
**Extract** — `withdraw(pointsToHiloWei(HP))` capped by credit.  
**Wipe** — 0 HP or forfeit → credit remains vaulted → deposit again to re-enter.

## Tech stack

| Layer | Stack |
|-------|-------|
| App | React 19, Vite 7, wagmi / viem, RainbowKit |
| Landing | Sentient + Geist Mono, R3F particle field |
| Contracts | Solidity 0.8.24, Foundry (`HILO.sol`, `HigherVault.sol`) |
| RNG client | `src/lib/rng.js` (HMAC commit / shuffle / verify) |

## Benefit to the web3 ecosystem

1. **Consumer clarity** — A complete on-chain money loop that fits in one screen and one sentence.  
2. **Fee honesty** — Explicit 20/80 split at entry; no mid-hand rake surprises.  
3. **Fairness literacy** — Commit-and-shuffle as a teachable standard for game RNG.  
4. **Custody hygiene** — Player extract vs wipe forfeit; no admin drain story for credit.  
5. **Chain activation** — Real testnet traffic (wallet, gas, explorer) for Robinhood Chain’s gaming lane.  
6. **Forkable pattern** — Entry unit, fee BPS, HP↔token rate, and vault credit are portable primitives.

## Status & caveats

- **Testnet only** — Peg and tokens are product/test parameters, not mainnet guarantees.  
- Live play uses **client HMAC shoe** + vault **deposit / withdraw / lose**; on-chain `guess`/`settle` exists in Solidity as a parallel path.  
- Not VRF; any future blockhash settlement inherits validator influence risks.

## One-line summary

> **HILO** = vaulted 1 HILO buy-in + 20s higher/lower table + HMAC-committed shoe + extract-or-wipe—built to make web3 gaming readable.

---

*See also: `docs/WHITEPAPER.md` · `docs/deck.html`*
