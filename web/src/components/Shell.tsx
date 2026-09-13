import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSkin } from '../theme/ThemeProvider.js';

export function Shell({ tableId, children }: { tableId?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const skin = useSkin();
  return (
    <div className="phone">
      <header className="topbar">
        <button type="button" aria-label="Menu" onClick={() => setOpen((value) => !value)}>
          ☰
        </button>
        <span className="brand">
          <span aria-hidden="true">{skin.icon}</span> JetonBro
        </span>
      </header>
      {open ? (
        <nav className="drawer" data-testid="nav-drawer">
          <Link to={tableId ? `/table/${tableId}` : '/'} onClick={() => setOpen(false)}>
            Table
          </Link>
          <Link to="/wallet" onClick={() => setOpen(false)}>
            Wallet
          </Link>
          <Link to="/standings" onClick={() => setOpen(false)}>
            Standings
          </Link>
          <Link to="/fun" onClick={() => setOpen(false)}>
            Fun
          </Link>
        </nav>
      ) : null}
      {children}
    </div>
  );
}
