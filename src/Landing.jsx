import { useCallback, useEffect, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import GameLoader from './GameLoader.jsx';
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

const SLIDES = [
  {
    title: 'Buy-in',
    body: 'Drop 1 HILO. 20% to treasury, 80% stays vaulted. You spawn on 20 HP.',
    tags: ['1 HILO', '20 HP', 'Vault'],
    img: PHOTOS.dice
  },
  {
    title: 'Call',
    body: 'Higher or lower on the live rank. One call. The match clock is 20 seconds.',
    tags: ['Higher', 'Lower', '20s'],
    img: PHOTOS.chips
  },
  {
    title: 'Shoe',
    body: 'HMAC-SHA256 shuffle, committed before you call. Not Math.random.',
    tags: ['HMAC', 'Commit', 'Fair'],
    img: PHOTOS.scatter
  },
  {
    title: 'Extract',
    body: '3 HP = 0.1 HILO. Time up with HP: bank or rebuy. Wipe at 0: rebuy only.',
    tags: ['0.1 HILO', 'Wipe', 'Pull'],
    img: PHOTOS.felt
  }
];

const BENTO = [
  {
    title: 'One signature',
    body: 'Connect, buy in, play. Approve + deposit in a single wallet call.',
    img: PHOTOS.deck,
    tone: 'light'
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
    img: null,
    tone: 'dark',
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

function DeckSlider({ size = 'hero' }) {
  const loop = [...DECK_SLIDER, ...DECK_SLIDER];
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

function Badge({ children }) {
  return <span className="tag">{children}</span>;
}

export default function Landing({ onPlay }) {
  const [booting, setBooting] = useState(() => {
    try { return sessionStorage.getItem('hilo-boot') !== '1'; } catch { return true; }
  });
  const [menu, setMenu] = useState(false);
  const [slide, setSlide] = useState(0);
  const [faq, setFaq] = useState(0);
  const [filter, setFilter] = useState('All');

  const finishBoot = useCallback(() => {
    try { sessionStorage.setItem('hilo-boot', '1'); } catch { /* ignore */ }
    setBooting(false);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menu ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menu]);

  const shownFaqs = filter === 'All'
    ? FAQS
    : FAQS.filter((f) => (
      filter === 'Play' ? /enter|higher|long/i.test(f.q) :
      filter === 'Bank' ? /cash|0 points/i.test(f.q) :
      /random|cards/i.test(f.q)
    ));

  const current = SLIDES[slide];

  return (
    <div className={`lp ink${booting ? ' lp-booting' : ''}${menu ? ' menu-on' : ''}`}>
      {booting && <GameLoader caption="ENTER THE GAME" onDone={finishBoot} />}

      <header className="nav">
        <DeckSlider size="nav" />
        <a className="brand" href="#hero">HILO</a>
        <nav className={`pill${menu ? ' open' : ''}`} aria-label="Primary">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setMenu(false)}>{l.label}</a>
          ))}
          <button className="btn-ink show-sm" type="button" onClick={() => { setMenu(false); onPlay(); }}>Enter match <span>↗</span></button>
        </nav>
        <div className="nav-end">
          <button className="btn-ink sm hide-sm" type="button" onClick={onPlay}>Enter <span>↗</span></button>
          <span className="hide-sm"><ConnectButton chainStatus="icon" showBalance={false} /></span>
          <button
            className="burger"
            type="button"
            aria-label={menu ? 'Close menu' : 'Open menu'}
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
          >
            <i /><i /><i />
          </button>
        </div>
      </header>

      <section className="sec hero" id="hero">
        <div className="hero-globe" aria-hidden="true">
          <img
            src="https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?auto=format&fit=crop&w=1600&q=60"
            alt=""
          />
        </div>
        <Badge>Live table</Badge>
        <h1>Call the next rank.<br />Bank the stack.</h1>
        <p className="lede">Higher or lower on a committed shoe. 1 HILO buy-in. 20 HP. 20 seconds. Zero is a wipe.</p>
        <div className="ctas">
          <button className="btn-ink" onClick={onPlay}>Enter match <span>↗</span></button>
          <a className="btn-ghost" href="#play">How it plays</a>
        </div>
        <DeckSlider size="hero" />
      </section>

      <section className="sec why" id="why">
        <Badge>Why HILO</Badge>
        <h2>A table you can read.</h2>
        <div className="why-stage">
          <img className="why-photo" src={PHOTOS.scatter} alt="Scattered playing cards on a dark table" />
          <article className="float-card left">
            <h3>Closed vault</h3>
            <p>Tokens leave only when you extract. A wipe keeps the bag in the house.</p>
          </article>
          <article className="float-card right">
            <h3>Committed shoe</h3>
            <p>HMAC shuffle, locked before the call. The next rank is not a browser roll.</p>
          </article>
        </div>
        <p className="lede tight">Same loop every round: buy-in, call, score, extract.</p>
        <button className="btn-ink" onClick={onPlay}>Start a round <span>↗</span></button>
      </section>

      <section className="sec bento" id="about">
        <Badge>The match</Badge>
        <h2>Built as one loop. No side quests.</h2>
        <p className="lede">Buy-in, call, clock, extract. Deck on the table. Rules in the open.</p>
        <div className="bento-row">
          {BENTO.map((c) => (
            <article key={c.title} className={`bento-card ${c.tone}`}>
              {c.img && <img src={c.img} alt="" />}
              {c.stat && <div className="stat">{c.stat}<span>HP</span></div>}
              <div className="bento-copy">
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="sec play" id="play">
        <Badge>How it plays</Badge>
        <h2>Four plates. One shoe.</h2>
        <div className="slide">
          <button className="slide-nav prev" type="button" aria-label="Previous" onClick={() => setSlide((s) => (s + SLIDES.length - 1) % SLIDES.length)}>‹</button>
          <article className="slide-card">
            <div className="slide-visual">
              <img src={current.img} alt="" />
              <img className="deck-chip" src="/art/card-ace.png" alt="" />
            </div>
            <div className="slide-copy">
              <p className="k">0{slide + 1}</p>
              <h3>{current.title}</h3>
              <p>{current.body}</p>
              <div className="chips">{current.tags.map((t) => <span key={t}>{t}</span>)}</div>
              <button className="btn-ink" onClick={onPlay}>Enter match <span>↗</span></button>
            </div>
          </article>
          <button className="slide-nav next" type="button" aria-label="Next" onClick={() => setSlide((s) => (s + 1) % SLIDES.length)}>›</button>
        </div>
        <div className="dots" role="tablist">
          {SLIDES.map((s, i) => (
            <button key={s.title} type="button" className={i === slide ? 'on' : ''} aria-label={s.title} onClick={() => setSlide(i)} />
          ))}
        </div>
      </section>

      <section className="sec faq" id="faq">
        <div className="faq-left">
          <Badge>FAQ</Badge>
          <h2>FAQ</h2>
          <div className="faq-contact">
            <p>Still unclear? Open a round. The table teaches faster than copy.</p>
            <button className="btn-ink dark" onClick={onPlay}>Enter match <span>↗</span></button>
          </div>
        </div>
        <div className="faq-right">
          <div className="filters">
            {['All', 'Play', 'Bank', 'Fair'].map((f) => (
              <button key={f} type="button" className={filter === f ? 'on' : ''} onClick={() => { setFilter(f); setFaq(0); }}>{f}</button>
            ))}
          </div>
          <ul className="acc">
            {shownFaqs.map((item, i) => (
              <li key={item.q}>
                <button type="button" onClick={() => setFaq(faq === i ? -1 : i)}>
                  {item.q}
                  <span>{faq === i ? '–' : '+'}</span>
                </button>
                {faq === i && <p>{item.a}</p>}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="foot">
        <div className="foot-top">
          <div>
            <a className="brand" href="#hero">HILO</a>
            <button className="btn-ink" onClick={onPlay}>Enter match <span>↗</span></button>
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
    </div>
  );
}
