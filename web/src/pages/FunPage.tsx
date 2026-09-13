import { Link } from 'react-router-dom';

export function FunPage() {
  return (
    <main>
      <h1>Fun</h1>
      <nav className="fun-menu" data-testid="fun-menu">
        <Link to="/fun/yellow">Yellow card</Link>
        <Link to="/fun/red">Red card</Link>
        <Link to="/fun/eight-ball">Magic 8-ball</Link>
      </nav>
    </main>
  );
}
