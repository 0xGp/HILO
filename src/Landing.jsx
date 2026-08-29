import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import GameLoader from './GameLoader.jsx';
import { VAULT_CA } from './lib/constants.js';
import './landing.css';

const u = (id, w = 1400) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const PHOTOS = {
  table: u('photo-1732613243572-c424f02cf821'),
  scatter: u('photo-1771862877468-bcbada32830c'),
  dice: u('photo-1646808911016-21d14de4df38'),
  chips: u('photo-1511193311914-0346f16efe90'),
  felt: u('photo-1606167668584-78701c57f13d'),
  deck: u('photo-1541278107931-e006523892df')
};

const LINKS = [
  { href: '#hero', label: 'Home' },
  { href: '#why', label: 'Table' },
  { href: '#play', label: 'Play' },
  { href: '#faq', label: 'FAQ' }
];

const HERO_FIXED = ['HIGHER', 'LOWER'];
const HERO_WORDS = ['CALL', 'EXTRACT', 'MATCH', 'SCORE'];

function HeroWord({ word, live = false, delayBase = 0 }) {
  return (
    <span className={`hero-word${live ? ' is-live' : ''}`}>
      {word.split('').map((ch, i) => (
        <span
          key={`${word}-${i}`}
          className={`hero-char${i === word.length - 1 ? ' accent' : ''}`}
          style={live ? { animationDelay: `${delayBase + i * 45}ms` } : undefined}
        >
          {ch}
        </span>
      ))}
      <span
        className="hero-char accent"
        style={live ? { animationDelay: `${delayBase + word.length * 45}ms` } : undefined}
      >
        .
      </span>
    </span>
  );
}

function AccentText({ text, marks = [] }) {
  if (!marks.length) return text;
  const parts = [];
  let cursor = 0;
  const hits = marks
    .map((mark) => ({ mark, at: text.indexOf(mark) }))
    .filter((h) => h.at !== -1)
    .sort((a, b) => a.at - b.at);
  hits.forEach(({ mark, at }) => {
    if (at < cursor) return;
    if (at > cursor) parts.push(text.slice(cursor, at));
    parts.push(<span key={`${mark}-${at}`} className="accent">{mark}</span>);
    cursor = at + mark.length;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts.length ? parts : text;
}

function shortCa(addr, head = 6, tail = 4) {
  if (!addr || addr.length < head + tail + 2) return addr || '';
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

function CaPill({ address, className = '', compact = false, full = false }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { /* ignore */ }
  };
  const label = compact
    ? 'CA'
    : full
      ? `CA: ${address}`
      : `CA: ${shortCa(address, 10, 8)}`;
  return (
    <button type="button" className={`ca-pill${compact ? ' ca-pill-compact' : ''}${className ? ` ${className}` : ''}`} onClick={copy} aria-label="Copy vault address">
      <span className="ca-mark" aria-hidden="true" />
      <span className="ca-text">{label}</span>
      {!compact && <span className="ca-copy" aria-hidden="true">{copied ? '✓' : '⧉'}</span>}
    </button>
  );
}

function AnimatedSphere() {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const runningRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || runningRef.current) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    runningRef.current = true;

    const chars = '░▒▓█│─┤├┴┬·';
    let time = 0;
    let alive = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      if (!alive) return;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w < 2 || h < 2) {
        frameRef.current = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, w, h);

      const centerX = w / 2;
      const centerY = h / 2;
      const radius = Math.min(w, h) * 0.46;
      const mobile = w < 520;
      const step = mobile ? 0.13 : 0.1;

      // Clip to a clean circle so the sphere never looks broken / doubled
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 2, 0, Math.PI * 2);
      ctx.clip();

      ctx.font = `${mobile ? 9 : 11}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const points = [];

      for (let phi = 0; phi < Math.PI * 2; phi += step) {
        for (let theta = 0; theta < Math.PI; theta += step) {
          const x = Math.sin(theta) * Math.cos(phi + time * 0.5);
          const y = Math.sin(theta) * Math.sin(phi + time * 0.5);
          const z = Math.cos(theta);

          const rotY = time * 0.28;
          const newX = x * Math.cos(rotY) - z * Math.sin(rotY);
          const newZ = x * Math.sin(rotY) + z * Math.cos(rotY);

          const rotX = time * 0.18;
          const newY = y * Math.cos(rotX) - newZ * Math.sin(rotX);
          const finalZ = y * Math.sin(rotX) + newZ * Math.cos(rotX);

          const depth = (finalZ + 1) / 2;
          const charIndex = Math.floor(depth * (chars.length - 1));

          points.push({
            x: centerX + newX * radius,
            y: centerY + newY * radius,
            z: finalZ,
            char: chars[charIndex]
          });
        }
      }

      points.sort((a, b) => a.z - b.z);
      points.forEach((point) => {
        const depth = (point.z + 1) / 2;
        const alpha = 0.2 + depth * 0.75;
        ctx.fillStyle = `rgba(232, 120, 48, ${Math.min(0.35 + depth * 0.65, 0.98)})`;
        if (depth < 0.35) {
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(alpha * 0.55, 0.55)})`;
        }
        ctx.fillText(point.char, point.x, point.y);
      });

      ctx.restore();
      time += mobile ? 0.014 : 0.018;
      frameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      alive = false;
      runningRef.current = false;
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="hero-sphere-canvas" aria-hidden="true" />;
}

const SLIDES = [
  {
    title: 'Buy-in',
    body: 'Drop 1 HILO. 20% to treasury, 80% stays vaulted. You spawn on 20 HP.',
    img: PHOTOS.dice
  },
  {
    title: 'Call',
    body: 'Higher or lower on the live rank. One call. The match clock is 20 seconds.',
    img: PHOTOS.chips
  },
  {
    title: 'Shoe',
    body: 'HMAC-SHA256 shuffle, committed before you call. Not Math.random.',
    img: PHOTOS.scatter
  },
  {
    title: 'Extract',
    body: '3 HP = 0.1 HILO. Time up with HP: bank or rebuy. Wipe at 0: rebuy only.',
    img: PHOTOS.felt
  }
];

const BENTO = [
  {
    title: 'One signature',
    body: 'Connect, buy in, play. Approve + deposit in a single wallet call.',
    img: PHOTOS.deck,
    tone: 'photo'
  },
  {
    title: 'Twenty seconds',
    body: 'The clock is the round, not each guess. When it hits zero, the result takes the table.',
    img: PHOTOS.table,
    tone: 'photo'
  },
  {
    title: 'Twenty HP',
    body: 'Hit +3. Miss −3. Zero is a wipe. You pull your own stack.',
    img: '/art/twenty-hp.png',
    tone: 'photo portrait',
    stat: '20'
  }
];

const FAQS = [
  { q: 'How do I enter a match?', a: 'Connect a wallet on Robinhood Chain Testnet and deposit 1 HILO ($20). You spawn with 20 HP.' },
  { q: 'What is higher or lower?', a: 'Call whether the next rank is higher or lower than the card on the table. Ace has no higher. Two has no lower.' },
  { q: 'How long do I have?', a: '20 seconds for the whole round. Time up with HP left: withdraw or buy in again. Time up at 0: buy in again.' },
  { q: 'How does cash-out work?', a: '3 points = 0.1 HILO at a $20 peg. You pull that amount from the vault. Leftover credit stays locked.' },
  { q: 'What happens at 0 points?', a: 'You are out. The bag stays in the vault. Deposit 1 HILO to enter again.' },
  { q: 'Are the cards random?', a: 'No Math.random. The shoe is shuffled with HMAC-SHA256 and committed before you call.' }
];

const RANK_LABEL = {
  A: 'Ace',
  K: 'King',
  Q: 'Queen',
  J: 'Joker',
  '10': 'Ten',
  '9': 'Nine',
  '8': 'Eight',
  '7': 'Seven',
  '6': 'Six',
  '5': 'Five',
  '4': 'Four',
  '3': 'Three',
  '2': 'Two'
};

const SUIT_LABEL = { '♠': 'Spades', '♥': 'Hearts', '♦': 'Diamonds', '♣': 'Clubs' };

const CARD_DESC = {
  A: 'Ace — the ceiling. Nothing ranks higher. On the table, only lower calls are live.',
  K: 'King — one step below ace. Strong high card that anchors aggressive higher calls.',
  Q: 'Queen — mid-shoe power. Sits between the top and the middle of the spread.',
  J: 'Joker — the wild edge. Borderline ranks where calls feel sharp and risky.',
  '10': 'Ten — high number card. Often the safe pivot between face cards and the pack.',
  '9': 'Nine — upper middle. A common fork between higher and lower on a live shoe.',
  '8': 'Eight — dead center of the number run. Odds tighten around this rank.',
  '7': 'Seven — mid shoe. The spread above and below starts to even out here.',
  '6': 'Six — lower middle. Higher calls start needing real runway above.',
  '5': 'Five — low mid. The shoe leans lower; calls need conviction.',
  '4': 'Four — low rank. Higher is a stretch unless the table is very cold.',
  '3': 'Three — near the floor. Only two sits below before the deck bottom.',
  '2': 'Two — the basement. No lower call exists. Higher is the only live line.'
};

const DECK_SLIDER = [
  { r: 'A', s: '♠', red: false },
  { r: 'K', s: '♥', red: true },
  { r: 'Q', s: '♦', red: true },
  { r: 'J', s: '♣', red: false },
  { r: '10', s: '♠', red: false },
  { r: '9', s: '♥', red: true },
  { r: '8', s: '♦', red: true },
  { r: '7', s: '♣', red: false },
  { r: '6', s: '♠', red: false },
  { r: '5', s: '♥', red: true },
  { r: '4', s: '♦', red: true },
  { r: '3', s: '♣', red: false },
  { r: '2', s: '♠', red: false },
  { r: 'A', s: '♥', red: true },
  { r: 'K', s: '♣', red: false },
  { r: 'Q', s: '♠', red: false }
];

function useReveal() {
  const ref = useRef(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOn(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.16, rootMargin: '0px 0px -6% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return [ref, on];
}

function Reveal({ as: Tag = 'div', className = '', delay = 0, children, ...rest }) {
  const [ref, on] = useReveal();
  return (
    <Tag
      ref={ref}
      className={`reveal-el${on ? ' is-in' : ''}${className ? ` ${className}` : ''}`}
      style={delay ? { '--d': `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}

const CRYPTIC_GLYPHS = '▓░▒█▄▀◊⌁∴∷⊹⌬◈◆◇';

function useCryptic(label) {
  const [text, setText] = useState(label);
  const frameRef = useRef(null);

  const scramble = useCallback(() => {
    if (frameRef.current) window.clearInterval(frameRef.current);
    let frame = 0;
    frameRef.current = window.setInterval(() => {
      frame += 1;
      if (frame > 10) {
        window.clearInterval(frameRef.current);
        frameRef.current = null;
        setText(label);
        return;
      }
      setText(
        label
          .split('')
          .map((ch, i) => {
            if (ch === ' ') return ' ';
            const settle = frame > 6 && i <= frame - 6;
            if (settle || Math.random() > 0.55) return label[i];
            return CRYPTIC_GLYPHS[Math.floor(Math.random() * CRYPTIC_GLYPHS.length)];
          })
          .join('')
      );
    }, 42);
  }, [label]);

  useEffect(() => () => {
    if (frameRef.current) window.clearInterval(frameRef.current);
  }, []);

  useEffect(() => { setText(label); }, [label]);

  return { text, scramble };
}

function CrypticText({ as: Tag = 'span', label, className = '', style, children, ...rest }) {
  const { text, scramble } = useCryptic(label);
  return (
    <Tag
      className={`cryptic-link${className ? ` ${className}` : ''}`}
      style={style}
      onMouseEnter={scramble}
      onFocus={scramble}
      onTouchStart={scramble}
      {...rest}
    >
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{label}</span>
      {children}
    </Tag>
  );
}

function CrypticLink({ href, label, onClick, className = '', style }) {
  return (
    <CrypticText
      as="a"
      href={href}
      label={label}
      className={className}
      style={style}
      onClick={onClick}
    />
  );
}

function CrypticZone({ as: Tag = 'div', className = '', children, ...rest }) {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;

    const skipTags = new Set(['SCRIPT', 'STYLE', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'SVG']);
    const timers = new Map();

    const scrambleEl = (el, original) => {
      if (timers.has(el)) window.clearInterval(timers.get(el));
      let frame = 0;
      const id = window.setInterval(() => {
        frame += 1;
        if (frame > 10) {
          window.clearInterval(id);
          timers.delete(el);
          el.textContent = original;
          return;
        }
        el.textContent = original
          .split('')
          .map((ch, i) => {
            if (ch === ' ') return ' ';
            const settle = frame > 6 && i <= frame - 6;
            if (settle || Math.random() > 0.55) return original[i];
            return CRYPTIC_GLYPHS[Math.floor(Math.random() * CRYPTIC_GLYPHS.length)];
          })
          .join('');
      }, 42);
      timers.set(el, id);
    };

    const shouldSkip = (node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return false;
      if (skipTags.has(node.tagName)) return true;
      if (node.closest('.deck-rail, .mobile-nav, .pill, .nav, .burger, .dots, .slide-nav, .acc button, .cryptic-link, .hero-brand, .brand, .btn-ink, .btn-ghost, .sr-only')) return true;
      return false;
    };

    const wrapTextNode = (textNode) => {
      const text = textNode.nodeValue;
      if (!text?.trim()) return;
      const parent = textNode.parentElement;
      if (!parent || shouldSkip(parent) || parent.classList.contains('cryptic-word')) return;

      const frag = document.createDocumentFragment();
      text.split(/(\s+)/).forEach((part) => {
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
        } else if (part) {
          const span = document.createElement('span');
          span.className = 'cryptic-word';
          span.textContent = part;
          const original = part;
          span.addEventListener('mouseenter', () => scrambleEl(span, original));
          span.addEventListener('focus', () => scrambleEl(span, original));
          span.addEventListener('touchstart', () => scrambleEl(span, original), { passive: true });
          span.tabIndex = 0;
          frag.appendChild(span);
        }
      });
      parent.replaceChild(frag, textNode);
    };

    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        wrapTextNode(node);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (shouldSkip(node)) return;
      if (node.classList?.contains('cryptic-word')) return;
      Array.from(node.childNodes).forEach(walk);
    };

    walk(root);

    return () => {
      timers.forEach((id) => window.clearInterval(id));
      timers.clear();
    };
  }, [children]);

  return (
    <Tag ref={ref} className={`cryptic-zone${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </Tag>
  );
}

function DeckSlider({ size = 'hero', interactive = false }) {
  const [expanded, setExpanded] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(null);
  const loop = [...DECK_SLIDER, ...DECK_SLIDER];

  useEffect(() => {
    if (!interactive || !expanded) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [interactive, expanded]);

  useEffect(() => {
    if (!expanded) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);

  const openCard = (card) => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setClosing(false);
    setShowDetail(false);
    setExpanded(card);
  };

  const close = () => {
    if (closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setExpanded(null);
      setShowDetail(false);
      setClosing(false);
    }, 480);
  };

  if (!interactive) {
    return (
      <div className={`deck-rail deck-rail-${size}`} aria-hidden="true">
        <div className="deck-rail-track">
          {loop.map((c, i) => (
            <span key={`${size}-${c.r}${c.s}${i}`} className={`deck-mini${c.red ? ' red' : ''}`}>
              <b>{c.r}</b>
              <i>{c.s}</i>
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`deck-rail deck-rail-${size}${expanded ? ' paused' : ''}`}>
        <div className="deck-rail-track">
          {loop.map((c, i) => {
            const key = `${size}-${c.r}${c.s}${i}`;
            const label = RANK_LABEL[c.r] || c.r;
            return (
              <button
                key={key}
                type="button"
                className={`deck-mini deck-mini-btn${c.red ? ' red' : ''}`}
                onClick={() => openCard({ key, ...c, label })}
                aria-label={`${label} of ${SUIT_LABEL[c.s] || c.s}`}
              >
                <b>{c.r}</b>
                <i>{c.s}</i>
              </button>
            );
          })}
        </div>
      </div>
      {expanded && createPortal(
        <div className={`deck-expand-backdrop${closing ? ' is-closing' : ''}`} onClick={close} role="presentation">
          <div
            className={`deck-expand-shell${showDetail ? ' is-detail' : ''}${closing ? ' is-closing' : ''}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${expanded.label} of ${SUIT_LABEL[expanded.s]}`}
          >
            <aside className="deck-expand-desc" aria-hidden={!showDetail}>
              <p className="deck-expand-desc-eyebrow">{SUIT_LABEL[expanded.s]}</p>
              <h3 className="deck-expand-desc-title">{expanded.label}</h3>
              <p className="deck-expand-desc-body">{CARD_DESC[expanded.r]}</p>
            </aside>
            <article className={`deck-expand-card${expanded.red ? ' red' : ''}`}>
              <button type="button" className="deck-expand-close" aria-label="Close card" onClick={close}>×</button>
              {!showDetail && (
                <button
                  type="button"
                  className="deck-expand-view"
                  aria-label="View card description"
                  onClick={() => setShowDetail(true)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                  <span>View</span>
                </button>
              )}
              <span className="deck-expand-tag">{expanded.label}</span>
              <b>{expanded.r}</b>
              <i>{expanded.s}</i>
              <p className="deck-expand-suit">{SUIT_LABEL[expanded.s]}</p>
            </article>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default function Landing({ onPlay }) {
  const [booting, setBooting] = useState(() => {
    try { return sessionStorage.getItem('hilo-boot') !== '1'; } catch { return true; }
  });
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);
  const [heroIn, setHeroIn] = useState(false);
  const [slide, setSlide] = useState(0);
  const [faq, setFaq] = useState(0);
  const touchX = useRef(null);
  const heroRef = useRef(null);
  const sphereRef = useRef(null);
  const titleRef = useRef(null);
  const caRef = useRef(null);
  const ctaRef = useRef(null);
  const gridRef = useRef(null);
  const parallaxRaf = useRef(0);

  const finishBoot = useCallback(() => {
    try { sessionStorage.setItem('hilo-boot', '1'); } catch { /* ignore */ }
    setBooting(false);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menu ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menu]);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const applyParallax = () => {
      parallaxRaf.current = 0;
      const y = window.scrollY;
      setScrolled(y > 20);
      if (reduce) return;

      const hero = heroRef.current;
      const h = hero ? hero.offsetHeight : window.innerHeight;
      const progress = Math.min(Math.max(y / Math.max(h, 1), 0), 1.4);
      const mobile = window.innerWidth <= 960;
      const sphereY = mobile ? 36 : 120;
      const sphereScale = mobile ? 0 : 0.12;
      const titleY = mobile ? -28 : -70;
      const caY = mobile ? -16 : -40;
      const ctaY = mobile ? -12 : -28;

      if (sphereRef.current) {
        sphereRef.current.style.transform = mobile
          ? `translate(-50%, calc(-50% + ${progress * sphereY}px))`
          : `translate(-50%, calc(-50% + ${progress * sphereY}px)) scale(${1 + progress * sphereScale})`;
        sphereRef.current.style.opacity = String(Math.max(0.35, 0.95 - progress * (mobile ? 0.35 : 0.55)));
      }
      if (gridRef.current) {
        gridRef.current.style.transform = `translate3d(0, ${progress * (mobile ? 18 : 40)}px, 0)`;
      }
      if (titleRef.current) {
        titleRef.current.style.transform = `translate3d(0, ${progress * titleY}px, 0)`;
        titleRef.current.style.opacity = progress > 0.02
          ? String(Math.max(0, 1 - progress * (mobile ? 0.55 : 0.85)))
          : '';
      }
      if (caRef.current) {
        caRef.current.style.transform = `translate3d(0, ${progress * caY}px, 0)`;
        caRef.current.style.opacity = progress > 0.02
          ? String(Math.max(0, 1 - progress * (mobile ? 0.7 : 1.1)))
          : '';
      }
      if (ctaRef.current) {
        ctaRef.current.style.transform = `translate3d(0, ${progress * ctaY}px, 0)`;
        ctaRef.current.style.opacity = progress > 0.02
          ? String(Math.max(0, 1 - progress * (mobile ? 0.85 : 1.25)))
          : '';
      }
    };

    const onScroll = () => {
      if (parallaxRaf.current) return;
      parallaxRaf.current = requestAnimationFrame(applyParallax);
    };

    applyParallax();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (parallaxRaf.current) cancelAnimationFrame(parallaxRaf.current);
    };
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setHeroIn(true), 40);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setWordIndex((w) => (w + 1) % HERO_WORDS.length);
    }, 2500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSlide((s) => (s + 1) % SLIDES.length);
    }, 5600);
    return () => window.clearInterval(id);
  }, [slide]);

  const go = (dir) => setSlide((s) => (s + dir + SLIDES.length) % SLIDES.length);
  const word = HERO_WORDS[wordIndex];

  return (
    <div className={`lp${booting ? ' lp-booting' : ''}${menu ? ' menu-on' : ''}`}>
      {booting && <GameLoader caption="ENTER THE GAME" onDone={finishBoot} />}

      <header className={`nav-shell${scrolled || menu ? ' is-scrolled' : ''}${menu ? ' is-menu' : ''}`}>
        <nav className={`nav-bar${scrolled || menu ? ' is-solid' : ''}`} aria-label="Primary">
          <CrypticText as="a" className="brand" href="#hero" label="HILO" />
          <CaPill address={VAULT_CA} className="nav-ca hide-sm" />
          <div className="nav-links hide-sm">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="nav-a">{l.label}</a>
            ))}
          </div>
          <div className="nav-end">
            <CaPill address={VAULT_CA} className="nav-ca-mobile show-sm" compact />
            <button className="btn-ink sm hide-sm" type="button" onClick={onPlay}>Enter match</button>
            <button
              className={`burger${menu ? ' open' : ''}`}
              type="button"
              aria-label={menu ? 'Close menu' : 'Open menu'}
              aria-expanded={menu}
              onClick={() => setMenu((v) => !v)}
            >
              <i /><i /><i />
            </button>
          </div>
        </nav>
      </header>

      <div className={`mobile-nav${menu ? ' open' : ''}`} aria-hidden={!menu}>
        <div className="mobile-nav-bg" aria-hidden="true" />
        <nav className="mobile-nav-links" aria-label="Mobile">
          {LINKS.map((l, i) => (
            <a
              key={l.href}
              href={l.href}
              className="mobile-link"
              style={{ '--i': i }}
              onClick={() => setMenu(false)}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="mobile-nav-foot">
          <ConnectButton chainStatus="icon" showBalance={false} />
          <button className="btn-ink" type="button" onClick={() => { setMenu(false); onPlay(); }}>
            Enter match
          </button>
        </div>
      </div>

      <CrypticZone className="lp-body">
      <section className={`sec hero${heroIn ? ' is-in' : ''}`} id="hero" ref={heroRef}>
        <div className="hero-grid" ref={gridRef} aria-hidden="true" />
        <div className="hero-sphere" ref={sphereRef} aria-hidden="true"><AnimatedSphere /></div>

        <div className="hero-inner">
          <div className="hero-parallax-title" ref={titleRef}>
            <h1 className="hero-title">
              <span className="hero-title-line hero-title-fixed">
                {HERO_FIXED.map((w) => (
                  <HeroWord key={w} word={w} />
                ))}
              </span>
              <span className="hero-title-line hero-title-live">
                <HeroWord key={word} word={word} live />
              </span>
            </h1>
          </div>

          <div className="hero-parallax-ca" ref={caRef}>
            <CaPill address={VAULT_CA} className="hero-ca" />
          </div>

          <div className="hero-ctas hero-parallax-cta" ref={ctaRef}>
            <button className="btn-launch" type="button" onClick={onPlay}>
              <span className="btn-launch-ico" aria-hidden="true">→</span>
              <span>Enter match</span>
            </button>
          </div>
        </div>
      </section>

      <section className="sec why" id="why">
        <Reveal as="p" className="eyebrow">Why <span className="accent">HILO</span></Reveal>
        <Reveal as="h2" delay={70}>
          <AccentText text="A table you can read." marks={['read']} />
        </Reveal>
        <div className="why-stage">
          <Reveal as="img" className="why-photo zoom-card" delay={80} src={PHOTOS.scatter} alt="Scattered playing cards on a dark table" />
          <Reveal as="article" className="float-card left zoom-card" delay={200}>
            <h3><AccentText text="Closed vault" marks={['vault']} /></h3>
            <p>Tokens leave only when you extract. A wipe keeps the bag in the house.</p>
          </Reveal>
          <Reveal as="article" className="float-card right zoom-card" delay={320}>
            <h3><AccentText text="Committed shoe" marks={['shoe']} /></h3>
            <p>HMAC shuffle, locked before the call. The next rank is not a browser roll.</p>
          </Reveal>
        </div>
        <Reveal as="p" className="lede tight" delay={180}>
          Same loop every round: <span className="accent">buy-in</span>, call, score, <span className="accent">extract</span>.
        </Reveal>
        <Reveal delay={220}>
          <button className="btn-ink" type="button" onClick={onPlay}>Start a round</button>
        </Reveal>
      </section>

      <section className="sec bento" id="about">
        <Reveal as="p" className="eyebrow">The <span className="accent">match</span></Reveal>
        <Reveal as="h2" className="fade-title" delay={60}>
          <AccentText text="Built as one loop. No side quests." marks={['loop', 'quests']} />
        </Reveal>
        <Reveal as="p" className="lede fade-title" delay={140}>
          Buy-in, call, clock, extract. Deck on the table. Rules in the open.
        </Reveal>
        <div className="bento-row">
          {BENTO.map((c, i) => (
            <Reveal key={c.title} as="article" className={`bento-card zoom-card ${c.tone}`} delay={120 + i * 140}>
              {c.img && <img src={c.img} alt="" />}
              {c.stat && <div className="stat">{c.stat}<span>HP</span></div>}
              <div className="bento-copy">
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="sec play" id="play">
        <Reveal as="p" className="eyebrow">How it <span className="accent">plays</span></Reveal>
        <Reveal as="h2" delay={70}>
          <AccentText text="Four plates. One shoe." marks={['plates', 'shoe']} />
        </Reveal>
        <Reveal className="carousel" delay={120}>
          <button className="slide-nav prev" type="button" aria-label="Previous" onClick={() => go(-1)}>‹</button>
          <div
            className="carousel-viewport"
            onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (touchX.current == null) return;
              const dx = e.changedTouches[0].clientX - touchX.current;
              touchX.current = null;
              if (Math.abs(dx) < 40) return;
              go(dx < 0 ? 1 : -1);
            }}
          >
            <div
              className="carousel-track"
              style={{
                '--slides': SLIDES.length,
                transform: `translateX(calc(-100% * ${slide} / ${SLIDES.length}))`
              }}
            >
              {SLIDES.map((s, i) => (
                <article key={s.title} className={`slide-card${i === slide ? ' active' : ''}`} aria-hidden={i !== slide}>
                  <div className="slide-visual">
                    <img src={s.img} alt="" />
                  </div>
                  <div className="slide-copy">
                    <p className="k">0{i + 1} / 0{SLIDES.length}</p>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                    <button className="btn-ink" type="button" onClick={onPlay}>Enter match</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <button className="slide-nav next" type="button" aria-label="Next" onClick={() => go(1)}>›</button>
        </Reveal>
        <div className="dots" role="tablist">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              type="button"
              className={i === slide ? 'on' : ''}
              aria-label={s.title}
              aria-selected={i === slide}
              onClick={() => setSlide(i)}
            />
          ))}
        </div>
      </section>

      <section className="sec faq" id="faq">
        <Reveal className="faq-left">
          <p className="eyebrow"><span className="accent">FAQ</span></p>
          <h2><AccentText text="Questions before the deal." marks={['deal']} /></h2>
          <div className="faq-contact">
            <p>Still unclear? Open a round. The table teaches faster than copy.</p>
            <button className="btn-ink dark" type="button" onClick={onPlay}>Enter match</button>
          </div>
        </Reveal>
        <div className="faq-right">
          <ul className="acc">
            {FAQS.map((item, i) => (
              <Reveal as="li" key={item.q} delay={80 + i * 70} className="faq-item">
                <button type="button" onClick={() => setFaq(faq === i ? -1 : i)}>
                  {item.q}
                  <span>{faq === i ? '–' : '+'}</span>
                </button>
                <div className={`acc-body${faq === i ? ' open' : ''}`}>
                  <p>{item.a}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <footer className="foot">
        <div className="foot-top">
          <div>
            <CrypticText as="a" className="brand" href="#hero" label="HILO" />
            <button className="btn-ink" type="button" onClick={onPlay}>Enter match</button>
          </div>
          <div>
            <h4>Play</h4>
            <a href="#hero">Home</a>
            <a href="#play">How it plays</a>
            <a href="#faq">FAQ</a>
          </div>
          <div>
            <h4>Table</h4>
            <a href="#why">Vault</a>
            <a href="#why">Shoe</a>
            <a href="#about">Clock</a>
          </div>
          <div>
            <h4>Network</h4>
            <p>Robinhood Chain Testnet</p>
            <p>1 HILO = $20</p>
          </div>
        </div>
        <div className="foot-bot">
          <span>Photos via Unsplash</span>
          <a href="#hero">Back to top ↑</a>
        </div>
      </footer>
      </CrypticZone>
    </div>
  );
}
