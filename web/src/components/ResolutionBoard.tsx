import { useMemo, useState } from 'react';
import type { Api, TableBox, TableSnapshot } from '../api.js';

function outcomeLabel(id: string): string {
  return id
    .split('-')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function suggestedFor(box: TableBox, outcome: string, multipliers: Record<string, number> | null): number {
  if (box.suggestedPayout != null && box.outcome === outcome) {
    return box.suggestedPayout;
  }
  const factor = multipliers?.[outcome];
  if (factor == null) {
    return 0;
  }
  return Math.round(box.stake * factor);
}

export function ResolutionBoard({
  api,
  snapshot,
  onSnapshot,
  onError,
}: {
  api: Api;
  snapshot: TableSnapshot;
  onSnapshot: (next: TableSnapshot) => void;
  onError: (message: string) => void;
}) {
  const [outcomeByBox, setOutcomeByBox] = useState<Record<string, string>>({});
  const [payoutByBox, setPayoutByBox] = useState<Record<string, string>>({});

  const rows = useMemo(() => snapshot.boxes, [snapshot.boxes]);
  const outcomes = Object.keys(snapshot.multipliers ?? {});
  const defaultOutcome = outcomes[0] ?? '';

  async function confirm(box: TableBox) {
    const outcome = outcomeByBox[box.id] ?? box.outcome ?? defaultOutcome;
    const payout = Number(payoutByBox[box.id] ?? suggestedFor(box, outcome, snapshot.multipliers));
    onError('');
    try {
      onSnapshot(
        await api.act(snapshot.tableId, {
          actionId: 'declare-outcome',
          boxId: box.id,
          outcome,
          payoutAmount: payout,
        }),
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not confirm box');
    }
  }

  return (
    <section className="resolution-board" data-testid="resolution-board">
      <h2>Resolve boxes</h2>
      {rows.length === 0 ? <p className="muted">No boxes to resolve.</p> : null}
      {rows.map((box) => {
        const outcome = outcomeByBox[box.id] ?? box.outcome ?? defaultOutcome;
        const done = box.escrowState === 'RELEASED' || box.status === 'resolved';
        const suggestion = suggestedFor(box, outcome, snapshot.multipliers);
        const payout = payoutByBox[box.id] ?? String(suggestion);
        return (
          <article key={box.id} className="resolution-box" data-testid={`resolve-box-${box.id}`}>
            <p>
              {box.ownerLabel} · {box.stake} locked
              {done ? ` · ${box.outcome ?? outcome}` : ''}
            </p>
            {done ? (
              <p className="muted">Released {box.suggestedPayout ?? payout}</p>
            ) : (
              <>
                <div className="outcome-row">
                  {outcomes.map((id) => (
                    <label key={id}>
                      <input
                        type="radio"
                        name={`outcome-${box.id}`}
                        checked={outcome === id}
                        onChange={() => {
                          setOutcomeByBox((current) => ({ ...current, [box.id]: id }));
                          setPayoutByBox((current) => ({
                            ...current,
                            [box.id]: String(suggestedFor(box, id, snapshot.multipliers)),
                          }));
                        }}
                      />
                      {outcomeLabel(id)}
                    </label>
                  ))}
                </div>
                <label>
                  Payout
                  <input
                    value={payout}
                    inputMode="numeric"
                    onChange={(event) =>
                      setPayoutByBox((current) => ({ ...current, [box.id]: event.target.value }))
                    }
                  />
                </label>
                <p className="muted">Suggested {suggestion} (editable before release)</p>
                <button type="button" onClick={() => void confirm(box)}>
                  Confirm release
                </button>
              </>
            )}
          </article>
        );
      })}
    </section>
  );
}
