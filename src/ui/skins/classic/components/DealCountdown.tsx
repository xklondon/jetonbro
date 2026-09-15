"use client";

import { useEffect, useState } from "react";

export function DealCountdown({ deadline, label = "Cards in" }: { deadline: string | null; label?: string }) {
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline) {
      setSeconds(null);
      return;
    }
    function tick() {
      const remaining = Math.ceil((Date.parse(deadline!) - Date.now()) / 1000);
      setSeconds(remaining > 0 ? remaining : null);
    }
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [deadline]);

  if (!seconds) return null;
  return (
    <div className="deal-countdown" aria-live="polite">
      {label} {seconds}
    </div>
  );
}
