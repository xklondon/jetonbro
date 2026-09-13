import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EIGHT_BALL_ANSWERS, pickAnswer } from './answers.js';

export function EightBallPage() {
  const [answer, setAnswer] = useState<string | null>(null);

  function reveal() {
    setAnswer(pickAnswer());
  }

  useEffect(() => {
    function onMotion(event: DeviceMotionEvent) {
      const acc = event.accelerationIncludingGravity;
      if (!acc) {
        return;
      }
      const magnitude = Math.hypot(acc.x ?? 0, acc.y ?? 0, acc.z ?? 0);
      if (magnitude > 22) {
        reveal();
      }
    }
    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, []);

  return (
    <main className="eight-ball-page">
      <p>
        <Link to="/fun">Fun</Link>
      </p>
      <h1>Magic 8-ball</h1>
      <button type="button" className="eight-ball" data-testid="eight-ball" onClick={reveal}>
        <span className="eight-ball-window" data-testid="eight-ball-answer">
          {answer ?? 'Tap or shake'}
        </span>
      </button>
      <p className="muted">{EIGHT_BALL_ANSWERS.length} stock answers, picked on this device.</p>
    </main>
  );
}
