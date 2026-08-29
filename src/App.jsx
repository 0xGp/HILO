import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance, useReadContract, useSendCalls, useSwitchChain, useWriteContract } from 'wagmi';
import { waitForCallsStatus } from '@wagmi/core';
import { encodeFunctionData } from 'viem';
import { getBalance, readContract, waitForTransactionReceipt } from 'wagmi/actions';
import {
  DECISION_SECS,
  ENTRY_USD,
  ERC20_ABI,
  FEE_ADDRESS,
  HILO_CA,
  ONE_HILO,
  PEG_USD,
  POINT_DELTA,
  pointsToHiloWei,
  RANKS,
  START_POINTS,
  VAULT_ABI,
  VAULT_CA
} from './lib/constants.js';
import {
  checkGuess,
  countAbove,
  countBelow,
  openRound,
  rankIdx,
  verifyCommitment,
  verifyDeck
} from './lib/rng.js';
import { MIN_GAS_ETH, rhTx, robinhoodTestnet, robinhoodWalletChain, wagmiConfig } from './chain.js';
import Landing from './Landing.jsx';
import GameLoader from './GameLoader.jsx';

function shortAddr(a) {
  if (!a) return '';
  return a.slice(0, 6) + '…' + a.slice(-4);
}

function formatUsd(n) {
  const v = Math.round(n * 100) / 100;
  return (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(v % 1 ? 2 : 0);
}

function formatHilo(wei) {
  if (wei == null) return '0.00';
  const whole = wei / (10n ** 18n);
  const frac = wei % (10n ** 18n);
  return (Number(whole) + Number(frac) / 1e18).toFixed(2);
}

function formatEth(wei) {
  if (wei == null) return '0';
  const v = Number(wei) / 1e18;
  if (v === 0) return '0';
  if (v < 0.0001) return v.toFixed(6);
  return v.toFixed(4);
}

function failText(err) {
  return String(err?.shortMessage || err?.cause?.shortMessage || err?.message || err?.cause?.message || '');
}

function isGasError(raw) {
  return /insufficient funds|insufficient fee|gas required exceeds|maxFeePerGas|maxPriorityFeePerGas|not enough gas|gas balance|exceeds the balance of the account|intrinsic gas/i.test(raw);
}

function isHiloError(raw) {
  return /does not have enough HILO|need 1 token|need 1 HILO|transfer amount exceeds balance|ERC20: transfer amount exceeds balance/i.test(raw);
}

function PlayingCard({ card, flipping, glow }) {
  const colorClass = card?.suit?.color === 'red' ? 'suit-red' : 'suit-black';
  return (
    <div className="card-stage">
      <div className="card-spotlight" aria-hidden="true" />
      <div className="flip-container">
        <div className={`flip-inner${flipping ? ' flipping' : ''}`}>
          <div className="card-face card-back" aria-hidden="true">
            <div className="card-back-mark">HILO</div>
          </div>
          <div
            className={`card-face front${glow === 'win' ? ' win-glow' : ''}${glow === 'lose' ? ' lose-glow' : ''}`}
            role="img"
            aria-label={card ? `${card.rank} of ${card.suit.sym}` : 'card'}
          >
            <div className="corner">
              <span className={`rank display ${colorClass}`}>{card?.rank || '—'}</span>
              <span className={`suit-mini ${colorClass}`}>{card?.suit?.sym || ''}</span>
            </div>
            <span className={`suit-center ${colorClass}`}>{card?.suit?.sym || ''}</span>
            <div className="corner bottom">
              <span className={`rank display ${colorClass}`}>{card?.rank || '—'}</span>
              <span className={`suit-mini ${colorClass}`}>{card?.suit?.sym || ''}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RangeRow({ label, ranks }) {
  return (
    <div className="range-cards-row">
      <span className="label">{label}</span>
      {(ranks.length ? ranks : ['none']).map((r) => (
        <span className="chip" key={label + r}>{r}</span>
      ))}
    </div>
  );
}

export default function App() {
  const { address, isConnected, chainId, connector } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { sendCallsAsync } = useSendCalls();

  const [view, setView] = useState('landing');
  const [entering, setEntering] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [gameMenu, setGameMenu] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    document.body.style.overflow = gameMenu ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [gameMenu]);
  const [depositing, setDepositing] = useState(false);
  const [depositStatus, setDepositStatus] = useState('');
  const [faceUp, setFaceUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [glow, setGlow] = useState('');
  const [bust, setBust] = useState(false);
  const [bustReason, setBustReason] = useState(null);
  const [timeUp, setTimeUp] = useState(null);
  const [secsLeft, setSecsLeft] = useState(null);
  const [cashout, setCashout] = useState(null);

  const [round, setRound] = useState(null);
  const [engine, setEngine] = useState(null);
  const [index, setIndex] = useState(0);
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [points, setPoints] = useState(0);
  const [lastDelta, setLastDelta] = useState(null);
  const [fairOk, setFairOk] = useState(null);
  const [active, setActive] = useState(false);

  const { data: hiloBal, refetch: refetchHilo } = useReadContract({
    address: HILO_CA,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: robinhoodTestnet.id,
    query: { enabled: !!address }
  });

  const { data: vaultHilo, refetch: refetchVaultHilo } = useReadContract({
    address: HILO_CA,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [VAULT_CA],
    chainId: robinhoodTestnet.id
  });

  const { data: ethBal, refetch: refetchEth } = useBalance({
    address,
    chainId: robinhoodTestnet.id,
    query: { enabled: !!address }
  });

  const busyRef = useRef(false);
  const endedRef = useRef(false);
  const remainMsRef = useRef(DECISION_SECS * 1000);
  const pointsRef = useRef(0);
  const loseBagRef = useRef(null);
  const missRef = useRef(null);
  const mustForfeitRef = useRef(false);
  const timeUpRef = useRef(null);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  function ping(text) {
    setToast(text);
    setTimeout(() => setToast(''), 1200);
  }

  function startDecisionClock() {
    remainMsRef.current = DECISION_SECS * 1000;
    setSecsLeft(DECISION_SECS);
  }

  function setPointsBoth(n) {
    pointsRef.current = n;
    setPoints(n);
  }

  async function loseBag(reason) {
    endedRef.current = true;
    mustForfeitRef.current = true;
    setActive(false);
    setPointsBoth(0);
    setBusy(false);
    setSecsLeft(0);
    setBust(true);
    setBustReason(reason);
    setLastDelta('zero');
    ping('0 points. Deposit 1 HILO to enter again.');
  }

  async function takeMiss(reason) {
    const next = Math.max(0, pointsRef.current - POINT_DELTA);
    setPointsBoth(next);
    setLastDelta(-POINT_DELTA);
    ping('−3 points');
    if (next <= 0) {
      await loseBag(reason);
      return;
    }
  }

  function endOnTime() {
    if (endedRef.current) return;
    endedRef.current = true;
    setBusy(false);
    setSecsLeft(0);
    setActive(false);
    const pts = pointsRef.current;
    if (pts <= 0) {
      void loseBag('time');
      return;
    }
    const wei = pointsToHiloWei(pts);
    const hilo = Number(formatHilo(wei));
    setTimeUp({ points: pts, hilo, usd: hilo * PEG_USD });
    ping("Time's up");
  }

  loseBagRef.current = loseBag;
  missRef.current = takeMiss;
  timeUpRef.current = endOnTime;

  useEffect(() => {
    if (!active || bust || cashout || timeUp) return undefined;
    const id = window.setInterval(() => {
      if (endedRef.current || busyRef.current) return;
      remainMsRef.current -= 100;
      const s = Math.max(0, Math.ceil(remainMsRef.current / 1000));
      setSecsLeft(s);
      if (remainMsRef.current <= 0) {
        remainMsRef.current = 0;
        timeUpRef.current?.();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [active, bust, cashout, timeUp]);

  const cashHiloWei = pointsToHiloWei(points);
  const cashUsd = Number(formatHilo(cashHiloWei)) * PEG_USD;
  const higherRanks = current ? RANKS.slice(rankIdx(current.rank) + 1) : [];
  const lowerRanks = current ? RANKS.slice(0, rankIdx(current.rank)) : [];
  const oddsUp = current ? Math.round((countAbove(current.rank) / 52) * 100) : 0;
  const oddsDown = current ? Math.round((countBelow(current.rank) / 52) * 100) : 0;

  const notEnoughHilo = isConnected && hiloBal != null && hiloBal < ONE_HILO;
  const notEnoughGas = isConnected && ethBal?.value != null && ethBal.value < MIN_GAS_ETH;

  const liveHelp = useMemo(() => {
    if (lastDelta === POINT_DELTA) return `${points} points. Hit +3 or withdraw ${formatHilo(cashHiloWei)} HILO (${formatUsd(cashUsd)}).`;
    if (lastDelta === -POINT_DELTA) return `${points} points. −3. At 0 you are out — deposit 1 HILO to enter again.`;
    if (lastDelta === 'zero') return '0 points. Deposit 1 HILO ($20) to enter again.';
    return '20 points in. Hit +3. Miss −3. 3 points = 0.1 HILO on withdraw. Hit 0 and you are out.';
  }, [lastDelta, points, cashHiloWei, cashUsd]);

  const startRoundWithEngine = useCallback(async (eng) => {
    setEngine(eng);
    setIndex(0);
    setCurrent(eng.deck[0]);
    setHistory([]);
    setPointsBoth(START_POINTS);
    setLastDelta(null);
    setFairOk(true);
    setActive(true);
    setBust(false);
    setBustReason(null);
    setTimeUp(null);
    endedRef.current = false;
    startDecisionClock();
    const n = new Uint32Array(1);
    crypto.getRandomValues(n);
    setRound(1000 + (n[0] % 9000));
    setFaceUp(false);
    setBusy(true);
    requestAnimationFrame(() => {
      setFaceUp(true);
      window.setTimeout(() => setBusy(false), 560);
    });
  }, []);

  async function ensureChain() {
    if (chainId === robinhoodTestnet.id) return;

    setDepositStatus('Wrong network. Switching to Robinhood Chain Testnet…');
    ping('Switch to Robinhood');

    try {
      await switchChainAsync({ chainId: robinhoodTestnet.id });
      return;
    } catch (err) {
      const code = err?.code ?? err?.cause?.code ?? err?.data?.originalError?.code;
      const needsAdd =
        code === 4902 ||
        code === -32603 ||
        /unrecognized chain|not added|added to the wallet/i.test(String(err?.message || err?.shortMessage || ''));

      if (!needsAdd) throw err;

      const provider = await connector?.getProvider?.();
      if (!provider?.request) {
        throw new Error('Open your wallet and add Robinhood Chain Testnet, then deposit again.');
      }

      setDepositStatus('Adding Robinhood Chain Testnet (official RPC)…');
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [robinhoodWalletChain]
      });
      await switchChainAsync({ chainId: robinhoodTestnet.id });
    }
  }

  async function onDeposit() {
    if (!isConnected) {
      openConnectModal?.();
      setDepositStatus('Connect your wallet, then tap deposit again.');
      return;
    }
    if (depositing) return;
    try {
      setDepositing(true);
      await ensureChain();
      setDepositStatus('On Robinhood testnet. 1 HILO ($20) will go into the vault.');
      await refetchHilo();
      await refetchEth();
      const gasWei = await getBalance(wagmiConfig, {
        address,
        chainId: robinhoodTestnet.id
      });
      if (gasWei.value < MIN_GAS_ETH) {
        throw new Error(
          `This wallet does not have enough gas. It has ${formatEth(gasWei.value)} ETH on Robinhood testnet. You need a little ETH to pay for the deposit.`
        );
      }
      const walletBal = await readContract(wagmiConfig, {
        address: HILO_CA,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
        chainId: robinhoodTestnet.id
      });
      if (walletBal < ONE_HILO) {
        throw new Error(
          `This wallet does not have enough HILO. It has ${formatHilo(walletBal)} HILO. Need 1 HILO ($20) to deposit.`
        );
      }

      const leftover = await readContract(wagmiConfig, {
        address: VAULT_CA,
        abi: VAULT_ABI,
        functionName: 'tokenBalance',
        args: [address],
        chainId: robinhoodTestnet.id
      });
      const allowance = await readContract(wagmiConfig, {
        address: HILO_CA,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, VAULT_CA],
        chainId: robinhoodTestnet.id
      });

      const calls = [];
      if (leftover > 0n) {
        if (mustForfeitRef.current) {
          calls.push({
            to: VAULT_CA,
            data: encodeFunctionData({ abi: VAULT_ABI, functionName: 'lose' }),
            gas: 120_000n
          });
        } else {
          calls.push({
            to: VAULT_CA,
            data: encodeFunctionData({ abi: VAULT_ABI, functionName: 'withdraw', args: [leftover] }),
            gas: 120_000n
          });
        }
      }
      if (allowance < ONE_HILO) {
        calls.push({
          to: HILO_CA,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [VAULT_CA, ONE_HILO]
          }),
          gas: 200_000n
        });
      }
      calls.push({
        to: VAULT_CA,
        data: encodeFunctionData({ abi: VAULT_ABI, functionName: 'deposit' }),
        gas: 2_000_000n
      });

      ping('Confirm deposit — one signature');
      const stepN = calls.length;
      setDepositStatus(
        stepN === 1
          ? 'Confirm deposit in your wallet…'
          : `Confirm once — ${stepN} steps bundled (clear · approve · deposit).`
      );
      let batched = false;
      try {
        const result = await sendCallsAsync({
          calls,
          chainId: robinhoodTestnet.id,
          forceAtomic: calls.length > 1
        });
        batched = true;
        const id = typeof result === 'string' ? result : result.id;
        await waitForCallsStatus(wagmiConfig, { id });
      } catch (batchErr) {
        if (batched) throw batchErr;
        // Wallet cannot EIP-5792 batch — fall back one tx at a time.
        let step = 1;
        const total = calls.length;
        if (leftover > 0n) {
          setDepositStatus(`Confirm ${step}/${total}: clear leftover vault credit…`);
          const pullHash = await writeContractAsync({
            address: VAULT_CA,
            abi: VAULT_ABI,
            functionName: mustForfeitRef.current ? 'lose' : 'withdraw',
            ...(mustForfeitRef.current ? {} : { args: [leftover] }),
            ...rhTx(120_000n)
          });
          await waitForTransactionReceipt(wagmiConfig, { hash: pullHash });
          step += 1;
        }
        if (allowance < ONE_HILO) {
          setDepositStatus(`Confirm ${step}/${total}: approve 1 HILO…`);
          const approveHash = await writeContractAsync({
            address: HILO_CA,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [VAULT_CA, ONE_HILO],
            ...rhTx(200_000n)
          });
          await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
          step += 1;
        }
        setDepositStatus(`Confirm ${step}/${total}: deposit into vault…`);
        const hash = await writeContractAsync({
          address: VAULT_CA,
          abi: VAULT_ABI,
          functionName: 'deposit',
          ...rhTx(2_000_000n)
        });
        await waitForTransactionReceipt(wagmiConfig, { hash });
      }
      await refetchHilo();
      await refetchVaultHilo();
      mustForfeitRef.current = false;

      setDepositStatus('Vault holds your HILO. Opening a committed shuffle…');
      const eng = await openRound({ address });
      const ok = (await verifyCommitment(eng.seed, eng.commitment)) && (await verifyDeck(eng.seed, eng.deck));
      if (!ok) throw new Error('Fairness self-check failed');
      setDepositStatus('Shuffle committed. You are in.');
      await startRoundWithEngine(eng);
    } catch (err) {
      const raw = failText(err);
      let msg = raw || 'Deposit cancelled';
      let pingMsg = 'Deposit failed';
      if (isGasError(raw) || /does not have enough gas/i.test(raw)) {
        msg = `This wallet does not have enough gas. It has ${formatEth(ethBal?.value)} ETH on Robinhood testnet. You need a little ETH to pay for the deposit.`;
        pingMsg = 'Not enough gas';
      } else if (isHiloError(raw)) {
        msg = `This wallet does not have enough HILO. It has ${formatHilo(hiloBal)} HILO. Need 1 HILO ($20) to deposit.`;
        pingMsg = 'Not enough HILO';
      }
      setDepositStatus(msg);
      ping(pingMsg);
    } finally {
      setDepositing(false);
    }
  }

  async function playGuess(higher) {
    if (!active || busy || !engine || !current) return;
    const curIdx = rankIdx(current.rank);
    if (higher && curIdx === 12) return;
    if (!higher && curIdx === 0) return;

    const nextIndex = index + 1;
    if (nextIndex >= engine.deck.length) {
      ping('Shoe empty');
      return;
    }

    const next = engine.deck[nextIndex];
    const deckOk = await verifyDeck(engine.seed, engine.deck);
    const commitOk = await verifyCommitment(engine.seed, engine.commitment);
    const derived = engine.deck[nextIndex];
    if (!deckOk || !commitOk || derived.id !== next.id) {
      setFairOk(false);
      ping('Fairness check failed');
      return;
    }

    const verdict = checkGuess(current, next, higher);
    if (!verdict.ok) {
      setFairOk(false);
      ping('Guess check failed');
      return;
    }
    setFairOk(true);
    setBusy(true);
    setFaceUp(false);
    setTimeout(() => {
      setCurrent(next);
      setIndex(nextIndex);
      setFaceUp(true);
      setTimeout(() => {
        if (verdict.won) {
          const nextPts = pointsRef.current + POINT_DELTA;
          setPointsBoth(nextPts);
          setLastDelta(POINT_DELTA);
          setHistory((h) => [...h, current]);
          setGlow('win');
          setTimeout(() => setGlow(''), 700);
          ping('+3 points');
        } else {
          setHistory((h) => [...h, current]);
          setGlow('lose');
          setTimeout(() => setGlow(''), 700);
          void takeMiss('wrong');
        }
        setBusy(false);
      }, 560);
    }, 260);
  }

  function resetTable() {
    setActive(false);
    setEngine(null);
    setCurrent(null);
    setHistory([]);
    setPointsBoth(0);
    setLastDelta(null);
    setBust(false);
    setBustReason(null);
    setCashout(null);
    setFaceUp(false);
    setBusy(false);
    setSecsLeft(null);
    setTimeUp(null);
    endedRef.current = false;
    setGlow('');
    setDepositStatus('');
  }

  async function onCashout() {
    if ((!active && !timeUp) || points <= 0 || depositing || busy) return;
    endedRef.current = true;
    const due = pointsToHiloWei(points);
    try {
      setDepositing(true);
      await ensureChain();
      const credit = await readContract(wagmiConfig, {
        address: VAULT_CA,
        abi: VAULT_ABI,
        functionName: 'tokenBalance',
        args: [address],
        chainId: robinhoodTestnet.id
      });
      const amount = due > 0n && due <= credit ? due : due > credit ? credit : 0n;
      if (amount === 0n) {
        await loseBag('wrong');
        return;
      }
      ping('Confirm vault withdraw');
      setDepositStatus('Cashing points out as HILO…');
      const hash = await writeContractAsync({
        address: VAULT_CA,
        abi: VAULT_ABI,
        functionName: 'withdraw',
        args: [amount],
        ...rhTx(120_000n)
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      await refetchHilo();
      await refetchVaultHilo();
      mustForfeitRef.current = false;
      const hilo = Number(formatHilo(amount));
      const usd = hilo * PEG_USD;
      setTimeUp(null);
      setActive(false);
      setCashout({ step: 0, usd, hilo, points });
      const delays = [350, 400, 450, 400];
      let i = 0;
      function tick() {
        if (i < 4) {
          setCashout((c) => (c ? { ...c, step: i } : c));
          setTimeout(() => {
            i += 1;
            tick();
          }, delays[Math.min(i, delays.length - 1)]);
        } else {
          setCashout((c) => (c ? { ...c, step: 4, done: true } : c));
        }
      }
      tick();
    } catch (err) {
      endedRef.current = false;
      const msg = err?.shortMessage || err?.message || 'Withdraw cancelled';
      setDepositStatus(msg);
      ping('Withdraw failed');
    } finally {
      setDepositing(false);
    }
  }

  const faceMsg =
    current?.rank === 'J' ? 'JACK — Both ways still live.' :
    current?.rank === 'Q' ? 'QUEEN — Getting thin.' :
    current?.rank === 'K' ? 'KING — Only Ace is higher.' :
    current?.rank === 'A' ? 'ACE — Nowhere higher. Go lower.' :
    current?.rank === '2' ? 'TWO — Nowhere lower. Go higher.' : '';

  return (
    <>
      {view === 'landing' && <Landing onPlay={() => setEntering(true)} />}
      {entering && (
        <GameLoader
          caption="ENTER THE GAME"
          onDone={() => {
            setView('game');
            setEntering(false);
          }}
        />
      )}

      {view === 'game' && (
        <div id="view-game" className={`game-in${gameMenu ? ' menu-on' : ''}`}>
          <header className="game-nav-shell">
            <nav className="game-nav-bar" aria-label="Game">
              <button
                type="button"
                className="game-brand"
                onClick={() => { setGameMenu(false); resetTable(); setView('landing'); }}
              >
                HILO
              </button>
              <button
                type="button"
                className="game-nav-ca game-hide-sm"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(VAULT_CA); } catch { /* ignore */ }
                }}
                aria-label="Copy vault address"
              >
                <span className="ca-mark" aria-hidden="true" />
                CA: {shortAddr(VAULT_CA)}
              </button>
              <div className="game-nav-mid game-hide-sm">
                <div className="round-badge">ROUND #<span>{round || '—'}</span></div>
              </div>
              <div className="game-nav-end">
                <button
                  type="button"
                  className="game-nav-ca game-show-sm"
                  onClick={async () => {
                    try { await navigator.clipboard.writeText(VAULT_CA); } catch { /* ignore */ }
                  }}
                  aria-label="Copy vault address"
                >
                  <span className="ca-mark" aria-hidden="true" />
                  CA
                </button>
                <button className="btn-ghost-sm game-hide-sm" type="button" onClick={() => setRulesOpen(true)}>How to play</button>
                <button
                  className="btn-ink-game sm game-hide-sm"
                  type="button"
                  onClick={() => { resetTable(); setView('landing'); }}
                >
                  Exit
                </button>
                <button
                  className={`game-burger${gameMenu ? ' open' : ''}`}
                  type="button"
                  aria-label={gameMenu ? 'Close menu' : 'Open menu'}
                  aria-expanded={gameMenu}
                  onClick={() => setGameMenu((v) => !v)}
                >
                  <i /><i /><i />
                </button>
              </div>
            </nav>
          </header>

          <div className={`game-mobile-nav${gameMenu ? ' open' : ''}`} aria-hidden={!gameMenu}>
            <div className="game-mobile-nav-bg" aria-hidden="true" />
            <nav className="game-mobile-nav-links" aria-label="Game mobile">
              <button type="button" className="game-mobile-link" onClick={() => { setGameMenu(false); setRulesOpen(true); }}>
                How to <span className="accent">play</span>
              </button>
              <div className="game-mobile-link" style={{ pointerEvents: 'none', opacity: 0.55, fontSize: 'clamp(18px,5vw,24px)', letterSpacing: '0.12em' }}>
                ROUND #<span className="accent">{round || '—'}</span>
              </div>
              <button
                type="button"
                className="game-mobile-link"
                onClick={() => { setGameMenu(false); resetTable(); setView('landing'); }}
              >
                Exit <span className="accent">match</span>
              </button>
            </nav>
            <div className="game-mobile-nav-foot">
              <button
                type="button"
                className="btn-ink-game"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(VAULT_CA); } catch { /* ignore */ }
                  setGameMenu(false);
                }}
              >
                Copy vault CA
              </button>
            </div>
          </div>

          <div className="lock-bar">
            <div className="lock-meta">
              <span className="lock-pill">VAULT LOCKED</span>
              <span>Buy-in $20 HILO</span>
              <span>+3 / −3 pts</span>
              <span>3 pts = 0.1 HILO</span>
              <span>0 pts = out</span>
            </div>
            <div className="ca-set">VAULT {shortAddr(VAULT_CA)} · {formatHilo(vaultHilo)} HILO · wallet {isConnected ? `${formatHilo(hiloBal)} HILO · ${formatEth(ethBal?.value)} ETH` : '—'}</div>
          </div>

          <div className="table-wrap">
            {!active && !bust && !cashout && !timeUp && (
              <div className="predeal">
                <div className="display">$20 HILO to get in.</div>
                <p className="predeal-note">Deposit 1 HILO ($20) to enter with 20 points. Hit +3. Miss −3. 3 points cash out as 0.1 HILO. At 0 points you are out and must deposit again.</p>
                <div className="logic-card">
                  <h3>Game logic</h3>
                  <div className="logic-line">1. Deposit <strong>1 HILO ($20)</strong>. Wallets that support batching sign once; others ask per step.</div>
                  <div className="logic-line">2. You start on <strong>20 points</strong>. <strong>20 seconds</strong> on the clock.</div>
                  <div className="logic-line">3. Hit <strong className="logic-win">+3 points</strong>. Miss <strong className="logic-lose">−3 points</strong>.</div>
                  <div className="logic-line">4. Withdraw: <strong>3 points = 0.1 HILO</strong> ({formatUsd(PEG_USD)} at peg).</div>
                  <div className="logic-line">5. <strong>0 points = out</strong>. Deposit 1 HILO to enter again.</div>
                </div>
                <button className="btn-dealme display" disabled={depositing || (isConnected && (notEnoughGas || notEnoughHilo))} onClick={onDeposit}>
                  {depositing
                    ? 'CONFIRM IN WALLET'
                    : isConnected && notEnoughGas
                      ? 'NOT ENOUGH GAS'
                      : isConnected && notEnoughHilo
                        ? 'NOT ENOUGH HILO'
                        : 'DEPOSIT $20 HILO'}
                </button>
                <p className="predeal-note" style={{ marginTop: 14, marginBottom: 0 }}>
                  {notEnoughGas
                    ? `This wallet does not have enough gas. It has ${formatEth(ethBal?.value)} ETH on Robinhood testnet. You need a little ETH to pay for the deposit.`
                    : notEnoughHilo
                      ? `This wallet does not have enough HILO. It has ${formatHilo(hiloBal)} HILO. Need 1 HILO ($20) to deposit.`
                      : depositStatus}
                </p>
                <button className="howtoplay-link" style={{ marginTop: 22 }} onClick={() => setRulesOpen(true)}>How does this work?</button>
              </div>
            )}

            {active && current && (
              <div className="play-board">
                <div className="play-hud">
                  <div className="hud-score">
                    <div className="hud-score-pts display">
                      {points}<span>pts</span>
                      <span className={`last-delta hud-delta${lastDelta === POINT_DELTA ? ' win' : lastDelta === -POINT_DELTA || lastDelta === 'zero' ? ' lose' : ''}`}>
                        {lastDelta === POINT_DELTA ? '+3' : lastDelta === -POINT_DELTA ? '−3' : lastDelta === 'zero' ? '0' : ''}
                      </span>
                    </div>
                    <div className="hud-score-hilo">{formatHilo(cashHiloWei)} HILO</div>
                  </div>
                  <div className={`decision-timer${secsLeft != null && secsLeft <= 10 ? ' urgent' : ''}${busy ? ' paused' : ''}`}>
                    <div className="decision-timer-num display">{secsLeft == null ? '—' : secsLeft}</div>
                    <div className="decision-timer-label">{busy ? 'wait' : 'sec'}</div>
                  </div>
                  <button className="btn-cashout play-withdraw" disabled={points <= 0 || busy || depositing} onClick={onCashout}>
                    {depositing ? 'CONFIRM' : 'WITHDRAW'}
                  </button>
                </div>

                <div className="play-card-wrap">
                  <p className="live-help">{liveHelp}</p>
                  <PlayingCard card={current} flipping={faceUp} glow={glow} />
                  <div className={`face-message${faceMsg ? ' show' : ''}`}>{faceMsg}</div>
                  <div className="odds-row">
                    {oddsUp}% <span className="odds-dim">higher</span> · {oddsDown}% <span className="odds-dim">lower</span>
                  </div>
                  <div className="play-ranges">
                    <RangeRow label="Higher" ranks={higherRanks} />
                    <RangeRow label="Lower" ranks={lowerRanks} />
                  </div>
                  <div className="history-trail">
                    {history.map((c, i) => (
                      <div key={i} className="trail-card" style={{ color: c.suit.color === 'red' ? 'var(--red-bright)' : 'var(--card-white)' }}>{c.rank}</div>
                    ))}
                  </div>
                </div>

                <div className="guess-row">
                  <button className="btn-higher display" disabled={busy || current.rank === 'A'} onClick={() => playGuess(true)}>HIGHER ↑</button>
                  <button className="btn-lower display" disabled={busy || current.rank === '2'} onClick={() => playGuess(false)}>LOWER ↓</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {bust && (
        <div className="overlay" role="alertdialog">
          <div className="overlay-card rekt">
            <div className="result-title rekt display">0 POINTS.</div>
            <div className="result-sub">{bustReason === 'time' ? 'Time ran out at 0 points.' : 'You lost. Points hit 0.'} Deposit 1 HILO ($20) to try again.</div>
            <div className="result-multi display">+3 / −3 · 3 pts = 0.1 HILO</div>
            <div className="result-multi-label">Buy in again</div>
            <div className="overlay-actions">
              <button
                className="btn-primary display"
                disabled={depositing}
                onClick={() => void onDeposit()}
              >
                {depositing ? 'CONFIRM IN WALLET' : 'DEPOSIT — TRY AGAIN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {timeUp && !cashout && (
        <div className="overlay" role="alertdialog">
          <div className="overlay-card">
            <div className="result-title win display">TIME’S UP</div>
            <div className="result-sub">You still have points. Withdraw them as HILO, or deposit 1 HILO to play again.</div>
            <div className="result-multi display">{timeUp.points} points</div>
            <div className="result-multi-label">3 pts = 0.1 HILO</div>
            <div className="result-eth display">{timeUp.hilo.toFixed(2)} HILO</div>
            <div className="result-usd">{formatUsd(timeUp.usd)} at $20 / token</div>
            <div className="overlay-actions">
              <button className="btn-cashout display" disabled={depositing} onClick={() => void onCashout()}>
                {depositing ? 'CONFIRM' : 'WITHDRAW'}
              </button>
              <button
                className="btn-primary display"
                disabled={depositing}
                onClick={() => {
                  mustForfeitRef.current = true;
                  void onDeposit();
                }}
              >
                {depositing ? 'CONFIRM' : 'DEPOSIT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cashout && (
        <div className="overlay" role="alertdialog">
          <div className="overlay-card">
            <div className="result-title win display">{cashout.done ? 'WITHDRAWN' : 'WITHDRAWING'}</div>
            <div className="result-sub">{cashout.done ? 'Bank closed for this round' : 'Checks · effects · HILO credit'}</div>
            <div className="tx-steps">
              {['Checks — bank and shoe', 'Effects — close the round', 'HMAC commitment held', 'Confirmed'].map((label, i) => (
                <div key={label} className={`tx-step${cashout.step > i ? ' done' : ''}${cashout.step === i && !cashout.done ? ' active' : ''}${cashout.done && i === 3 ? ' done' : ''}`}>
                  <span className="tick" /> {label}
                </div>
              ))}
            </div>
            {cashout.done && (
              <div>
                <div className="result-multi display">{cashout.hilo.toFixed(2)} HILO</div>
                <div className="result-multi-label">{cashout.points} points cashed · 3 pts = 0.1 HILO</div>
                <div className="result-eth display">{formatUsd(cashout.usd)}</div>
                <div className="result-usd">Pegged at $20 / token</div>
                <button className="btn-primary display" onClick={resetTable}>RUN IT BACK</button>
              </div>
            )}
          </div>
        </div>
      )}

      {rulesOpen && (
        <div className="modal-overlay" role="dialog" onClick={(e) => { if (e.target === e.currentTarget) setRulesOpen(false); }}>
          <div className="modal">
            <h2 className="display">HOW HILO WORKS</h2>
            <div className="modal-rule"><div className="num">01</div><div className="txt">Deposit 1 HILO ($20) to enter. You start on 20 points. One wallet signature.</div></div>
            <div className="modal-rule"><div className="num">02</div><div className="txt">Bet higher or lower. 20 seconds on the clock. Hit +3. Miss −3. When time is up: withdraw or deposit if you still have points. At 0: deposit and try again.</div></div>
            <div className="modal-rule"><div className="num">03</div><div className="txt">Withdraw converts points to HILO: 3 points = 0.1 HILO. Peg $20 per HILO.</div></div>
            <div className="modal-rule"><div className="num">04</div><div className="txt">When points hit 0 you are out. Deposit 1 HILO to enter again.</div></div>
            <div className="modal-tagline">20 points in. +3 / −3. 0 = out. 3 pts = 0.1 HILO.</div>
            <button className="btn-primary display" onClick={() => setRulesOpen(false)}>GOT IT</button>
          </div>
        </div>
      )}

      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </>
  );
}
