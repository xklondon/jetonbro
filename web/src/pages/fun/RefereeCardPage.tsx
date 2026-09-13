import { Link } from 'react-router-dom';

export function RefereeCardPage({ color }: { color: 'yellow' | 'red' }) {
  const title = color === 'yellow' ? 'Yellow card' : 'Red card';
  return (
    <main className={`fun-card-page fun-card-page-${color}`}>
      <p>
        <Link to="/fun">Fun</Link>
      </p>
      <div
        className={`referee-card referee-card-${color}`}
        data-testid={`${color}-card`}
        role="img"
        aria-label={title}
      >
        <span>{title}</span>
      </div>
    </main>
  );
}

export function YellowCardPage() {
  return <RefereeCardPage color="yellow" />;
}

export function RedCardPage() {
  return <RefereeCardPage color="red" />;
}
