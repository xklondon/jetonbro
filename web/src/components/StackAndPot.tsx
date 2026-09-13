import type { TableSnapshot } from '../api.js';

/**
 * Chip piles are sized from the same snapshot fields the escrow update wrote.
 * CSS transitions the height — there is no separate animation state.
 */
export function StackAndPot({ snapshot }: { snapshot: TableSnapshot }) {
  return (
    <section className="felt" aria-label="Stack and betting area">
      <ChipPile
        testId="stack-pile"
        label="Your stack"
        amount={snapshot.viewer.stack}
        kind="stack"
      />
      <ChipPile testId="pot-pile" label="Pot" amount={snapshot.pot.amount} kind="pot" />
      {snapshot.boxes.length > 0 ? (
        <ul className="boxes">
          {snapshot.boxes.map((box) => (
            <li key={box.id} data-testid={`box-${box.id}`} data-owner={box.ownerUserId}>
              Box {box.stake} · {box.status}
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
}: {
  testId: string;
  label: string;
  amount: number;
  kind: 'stack' | 'pot';
}) {
  const height = Math.min(160, 12 + amount * 2);
  return (
    <div className={`pile pile-${kind}`}>
      <div className="pile-label">{label}</div>
      <div
        className="chip-pile"
        data-testid={testId}
        data-amount={amount}
        style={{ height }}
      />
      <div className="pile-amount">{amount}</div>
    </div>
  );
}
