import type { TableSnapshot } from '../api.js';
import { denominationBreakdown } from '../theme/chips.js';
import { useAppearance } from '../theme/ThemeProvider.js';

/**
 * Chip piles are sized from the same snapshot fields the escrow update wrote.
 * CSS transitions the height — there is no separate animation state.
 * Chip-visual mode is a presentational breakdown of that same integer.
 */
export function StackAndPot({ snapshot }: { snapshot: TableSnapshot }) {
  const { chipVisual } = useAppearance();
  return (
    <section className="felt" aria-label="Stack and betting area">
      <ChipPile
        testId="stack-pile"
        label="Your stack"
        amount={snapshot.viewer.stack}
        kind="stack"
        chipVisual={chipVisual}
      />
      <ChipPile
        testId="pot-pile"
        label="Pot"
        amount={snapshot.pot.amount}
        kind="pot"
        chipVisual={chipVisual}
      />
      {snapshot.boxes.length > 0 ? (
        <ul className="boxes">
          {snapshot.boxes.map((box) => (
            <li key={box.id} data-testid={`box-${box.id}`} data-owner={box.ownerUserId}>
              {chipVisual ? (
                <ChipPile
                  testId={`box-pile-${box.id}`}
                  label={`Box ${box.status}`}
                  amount={box.stake}
                  kind="stack"
                  chipVisual
                />
              ) : (
                <>
                  Box {box.stake} · {box.status}
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function ChipPile({
  testId,
  label,
  amount,
  kind,
  chipVisual = false,
}: {
  testId: string;
  label: string;
  amount: number;
  kind: 'stack' | 'pot';
  chipVisual?: boolean;
}) {
  const height = Math.min(160, 12 + amount * 2);
  const stacks = chipVisual ? denominationBreakdown(amount) : [];
  return (
    <div className={`pile pile-${kind}`}>
      <div className="pile-label">{label}</div>
      {chipVisual ? (
        <div className="chip-pile chip-pile-visual" data-testid={testId} data-amount={amount}>
          {stacks.length === 0 ? <span className="muted">0</span> : null}
          {stacks.map((stack) => (
            <div key={stack.value} className="chip-column" data-denom={stack.value} data-count={stack.count}>
              {Array.from({ length: stack.count }, (_, index) => (
                <span key={index} className={`chip chip-${stack.value}`} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div
          className="chip-pile"
          data-testid={testId}
          data-amount={amount}
          style={{ height }}
        />
      )}
      <div className="pile-amount">{amount}</div>
    </div>
  );
}
