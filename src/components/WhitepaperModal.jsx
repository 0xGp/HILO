import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function WhitepaperModal({ onClose }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleOverlay = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  return createPortal(
    <div className="wp-modal-overlay" ref={overlayRef} onClick={handleOverlay} role="dialog" aria-modal="true" aria-label="HILO Whitepaper">
      <div className="wp-modal">
        <div className="wp-modal-header">
          <div className="wp-modal-header-left">
            <span className="wp-modal-tag">WHITEPAPER</span>
            <span className="wp-modal-version">v1.0 · Robinhood Chain Testnet</span>
          </div>
          <button className="wp-modal-close" type="button" onClick={onClose} aria-label="Close whitepaper">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="wp-modal-body">
          <div className="wp-modal-content">

            <div className="wp-title-block">
              <h1>HILO Whitepaper</h1>
              <p className="wp-subtitle">Higher / Lower · On-Chain Vaulted Play</p>
            </div>

            <hr className="wp-divider" />

            <section className="wp-section">
              <h2>Abstract</h2>
              <p>
                HILO is a higher-or-lower card game with vaulted buy-ins, a fixed match clock, and a
                committed shoe. Players deposit <strong>1 HILO</strong> ($20 peg) into a non-custodial
                vault, receive <strong>20 HP</strong>, and call whether the next rank is higher or lower
                than the card on the table. Outcomes settle against a{' '}
                <code>HMAC-SHA256</code> shuffled deck committed before the call. Value leaves the vault
                only when the player extracts; a wipe keeps the bag in the house.
              </p>
              <p>
                HILO shows a concrete path for consumer games on L2-style chains: simple rules,
                transparent economics, and on-chain custody for deposits and cash-outs — without turning
                the table into a casino black box.
              </p>
            </section>

            <hr className="wp-divider" />

            <section className="wp-section">
              <h2>1. Problem</h2>
              <p>Most on-chain games fail one of three tests:</p>
              <ol>
                <li><strong>Opacity</strong> — RNG is opaque or easily gamed; players cannot verify the shoe.</li>
                <li><strong>Custody risk</strong> — "House" contracts can drain, pause, or re-route funds.</li>
                <li><strong>Friction</strong> — Multi-step approvals, unclear fees, and long sessions kill casual play.</li>
              </ol>
              <p>
                Web3 still needs <strong>readable</strong> games: one buy-in, one loop, rules in the
                open, and money that only moves when the player says so.
              </p>
            </section>

            <hr className="wp-divider" />

            <section className="wp-section">
              <h2>2. What HILO Is</h2>
              <p>HILO is a <strong>single-loop table game</strong>:</p>
              <div className="wp-table-wrap">
                <table className="wp-table">
                  <thead>
                    <tr><th>Step</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Buy-in</td><td>Deposit <strong>1 HILO</strong> → 20% treasury fee, <strong>80% vaulted</strong> → spawn <strong>20 HP</strong></td></tr>
                    <tr><td>Call</td><td>Higher or lower vs the live rank · <strong>20-second</strong> match clock</td></tr>
                    <tr><td>Score</td><td>Hit <strong>+3 HP</strong> · Miss <strong>−3 HP</strong> · <strong>0 HP = wipe</strong></td></tr>
                    <tr><td>Extract</td><td><strong>3 HP = 0.1 HILO</strong> withdrawn from vault credit</td></tr>
                  </tbody>
                </table>
              </div>
              <p>Edge cases are explicit: Ace has no higher; Two has no lower. Same-rank draws count as a miss.</p>
              <p className="wp-callout">
                The product narrative is intentional: <em>call the higher / lower / faster / deeper rank</em> — through committed shoes and vaulted buy-ins.
              </p>
            </section>

            <hr className="wp-divider" />

            <section className="wp-section">
              <h2>3. How It Works</h2>

              <h3>3.1 Token &amp; peg</h3>
              <ul>
                <li><strong>HILO</strong> — ERC-20, 18 decimals, symbol <code>HILO</code></li>
                <li>Documented peg: <strong>$20 per HILO</strong></li>
                <li>Entry: <strong>1 HILO</strong> per match</li>
              </ul>

              <h3>3.2 Vault split</h3>
              <p>On <code>deposit()</code>:</p>
              <ul>
                <li><strong>0.2 HILO (20%)</strong> → fee / treasury recipient</li>
                <li><strong>0.8 HILO (80%)</strong> → player vault credit</li>
              </ul>
              <p>
                The vault does not expose an owner drain path for player credit. Funds exit via player{' '}
                <code>withdraw</code> (extract) or forfeit into the vault on wipe (<code>lose</code>).
              </p>

              <h3>3.3 Match loop</h3>
              <ol>
                <li>Wallet connects on <strong>Robinhood Chain Testnet</strong> (chain ID <code>46630</code>).</li>
                <li>Approve + deposit (batched when the wallet supports it).</li>
                <li>Client opens an HMAC shoe and starts the <strong>20s</strong> clock.</li>
                <li>Player calls Higher / Lower; HP updates.</li>
                <li>Time-up with HP → bank (extract) or rebuy. Wipe at 0 → rebuy only; credit stays vaulted.</li>
              </ol>

              <h3>3.4 Fairness model (shoe)</h3>
              <p>Before play, the client:</p>
              <ol>
                <li>Harvests entropy (CSPRNG + session context).</li>
                <li>Publishes a <strong>commitment</strong>: <code>SHA-256("HILO.commit.v1" ‖ seed)</code>.</li>
                <li>Shuffles a 52-card deck with Fisher–Yates using <code>HMAC-SHA256(seed, "HILO.u32.v1" ‖ …)</code> and rejection sampling.</li>
                <li>Verifies commitment and deck integrity before / during calls.</li>
              </ol>
              <p>Players are told — and the client enforces — that the next rank is not a naked <code>Math.random()</code> roll.</p>
              <div className="wp-note">
                <strong>Scope note:</strong> Live UI play uses the client HMAC shoe plus vault deposit / withdraw / lose.
                The Solidity vault also contains an alternate on-chain guess/settle path (blockhash-based) for contract
                tests; treat that as a parallel layer until the frontend wires those calls.
              </div>
            </section>

            <hr className="wp-divider" />

            <section className="wp-section">
              <h2>4. Benefit to the Web3 Ecosystem</h2>

              <h3>4.1 Proof of readable consumer UX</h3>
              <p>
                HILO compresses on-chain play into one mental model: <strong>deposit → call → extract</strong>.
                That pattern is reusable for other casual games on emerging chains (including Robinhood Chain),
                where first-time wallet users need clarity more than complexity.
              </p>

              <h3>4.2 Transparent fee surface</h3>
              <p>
                A fixed <strong>20% / 80%</strong> split at buy-in is auditable in constants and contracts. No
                hidden rake mid-hand. Ecosystem builders can copy the pattern for entry fees without inventing
                opaque house edges.
              </p>

              <h3>4.3 Committed randomness as a teaching tool</h3>
              <p>
                HMAC commit-and-shuffle gives a <strong>verifiable narrative</strong> players can understand:
                seed committed, deck fixed, calls checked. That raises the bar for "provably fair" expectations
                in web3 gaming — even when parts of the loop remain client-side.
              </p>

              <h3>4.4 Non-custodial vault discipline</h3>
              <p>
                Player credit is vaulted; extract is user-initiated; wipe does not invent a backdoor payout.
                This models <strong>house risk separation</strong>: treasury fee is explicit; player bag is
                either withdrawn by the player or forfeited by rule — not silently swept by an admin.
              </p>

              <h3>4.5 Chain activation</h3>
              <p>
                Running on Robinhood Chain Testnet exercises real wallet flows (approve, deposit, withdraw, gas),
                explorers, and RPC — useful demand for a new chain's gaming vertical without requiring a full DEX
                or lending stack first.
              </p>

              <h3>4.6 Composability of the loop</h3>
              <p>
                The economic primitives — entry unit, fee BPS, HP ↔ token conversion, vault credit — are small
                and portable. Other teams can fork the loop for different skill games while keeping the same
                custody story.
              </p>
            </section>

            <hr className="wp-divider" />

            <section className="wp-section">
              <h2>5. Token &amp; Contract Map</h2>
              <div className="wp-table-wrap">
                <table className="wp-table">
                  <thead>
                    <tr><th>Asset</th><th>Address (Testnet)</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>HILO token</td><td><code>0x19E1BE6480364b81ec0B6E5919c2EfaBe55ABE54</code></td></tr>
                    <tr><td>HigherVault</td><td><code>0xF16d0fFF51DeFfB3A2c3542661183d4A06c7f5Be</code></td></tr>
                    <tr><td>Fee recipient</td><td><code>0x974aB06E37dfD2d27FAc09c0E6194d2E13042DcC</code></td></tr>
                  </tbody>
                </table>
              </div>
              <div className="wp-table-wrap" style={{ marginTop: '16px' }}>
                <table className="wp-table">
                  <thead>
                    <tr><th>Network</th><th>Detail</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Name</td><td>Robinhood Chain Testnet</td></tr>
                    <tr><td>Chain ID</td><td><code>46630</code> (<code>0xb616</code>)</td></tr>
                    <tr><td>RPC</td><td><code>https://rpc.testnet.chain.robinhood.com</code></td></tr>
                    <tr><td>Explorer</td><td><code>https://explorer.testnet.chain.robinhood.com</code></td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            <hr className="wp-divider" />

            <section className="wp-section">
              <h2>6. Economic Parameters</h2>
              <div className="wp-table-wrap">
                <table className="wp-table">
                  <thead>
                    <tr><th>Parameter</th><th>Value</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Peg</td><td>$20 / HILO</td></tr>
                    <tr><td>Buy-in</td><td>1 HILO</td></tr>
                    <tr><td>Treasury fee</td><td>20% (0.2 HILO)</td></tr>
                    <tr><td>Vaulted</td><td>80% (0.8 HILO)</td></tr>
                    <tr><td>Start HP</td><td>20</td></tr>
                    <tr><td>Hit / miss</td><td>±3 HP</td></tr>
                    <tr><td>Extract rate</td><td>3 HP = 0.1 HILO</td></tr>
                    <tr><td>Match clock</td><td>20 seconds</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="wp-callout">
                Illustrative extract: <strong>20 HP → ~0.666… HILO</strong> (capped by vault credit).
              </p>
            </section>

            <hr className="wp-divider" />

            <section className="wp-section">
              <h2>7. Risk &amp; Limitations</h2>
              <ul>
                <li><strong>Testnet stage</strong> — tokens and vaults are for testing; pegs are product documentation, not exchange guarantees.</li>
                <li><strong>Client shoe</strong> — commitment is cryptographically structured; full trust minimization for the live shoe still depends on open-source verification and future on-chain wiring of play.</li>
                <li><strong>Blockhash path</strong> — if/when on-chain guess/settle is used, validators can influence <code>blockhash</code>; that path is not VRF.</li>
                <li><strong>Skill + variance</strong> — Ace/Two constraints and clock pressure create skill; wipe risk remains real.</li>
              </ul>
            </section>

            <hr className="wp-divider" />

            <section className="wp-section">
              <h2>8. Roadmap Themes</h2>
              <ol>
                <li>Harden shoe verification UX (publish commit, prove deck end-of-round).</li>
                <li>Optionally migrate call settlement fully on-chain where gas and UX allow.</li>
                <li>Mainnet / production tokenomics review after testnet usage data.</li>
                <li>Expand table variants while keeping the one-loop buy-in / extract story.</li>
              </ol>
            </section>

            <hr className="wp-divider" />

            <section className="wp-section">
              <h2>9. Conclusion</h2>
              <p>
                HILO is not "DeFi with cards." It is a <strong>tight consumer game</strong> with vaulted money,
                committed dealing, and rules a player can read in one screen. For web3, its value is the pattern:{' '}
                <strong>custody you can audit, fees you can see, fairness you can explain, and a loop short enough
                to finish in twenty seconds.</strong>
              </p>
            </section>

            <div className="wp-footer-note">
              <em>HILO · Call the rank · Vault the bag</em><br />
              © HILO contributors · Testnet documentation
            </div>

          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
