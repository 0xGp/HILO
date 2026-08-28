import { useEffect, useRef, useState } from 'react';

const TITLE = 'HILO';

export default function GameLoader({ caption = 'ENTER THE GAME', onDone }) {
  const [typed, setTyped] = useState('');
  const [flipped, setFlipped] = useState(false);
  const [showCap, setShowCap] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current?.();
  }

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setFlipped(true);
      setTyped(TITLE);
      setShowCap(true);
      const t = window.setTimeout(finish, 200);
      return () => window.clearTimeout(t);
    }

    const timers = [];
    timers.push(window.setTimeout(() => setFlipped(true), 280));

    TITLE.split('').forEach((_, i) => {
      timers.push(window.setTimeout(() => {
        setTyped(TITLE.slice(0, i + 1));
      }, 720 + i * 160));
    });

    timers.push(window.setTimeout(() => setShowCap(true), 720 + TITLE.length * 160 + 180));
    timers.push(window.setTimeout(() => setLeaving(true), 720 + TITLE.length * 160 + 1100));
    timers.push(window.setTimeout(finish, 720 + TITLE.length * 160 + 1600));

    return () => timers.forEach((id) => window.clearTimeout(id));
    // run once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`boot${leaving ? ' out' : ''}`}
      role="status"
      aria-live="polite"
      onClick={() => {
        if (doneRef.current) return;
        setLeaving(true);
        window.setTimeout(finish, 280);
      }}
    >
      <div className="boot-spot" aria-hidden="true" />
      <div className={`boot-card${flipped ? ' flipped' : ''}`} aria-hidden="true">
        <div className="boot-face boot-back">
          <span>HILO</span>
        </div>
        <div className="boot-face boot-joker">
          <img src="/art/card-joker.png" alt="" />
        </div>
      </div>
      <h1 className="boot-title" aria-label="HILO">
        {typed}
        {typed.length < TITLE.length ? <span className="boot-caret" /> : null}
      </h1>
      <p className={`boot-cap hud${showCap ? ' on' : ''}`}>{caption}</p>
      <p className="boot-skip">Tap to skip</p>
    </div>
  );
}
