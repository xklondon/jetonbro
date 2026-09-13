import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAppearance, useSkin } from '../theme/ThemeProvider.js';
import { SKINS, type SkinTokens } from '../theme/tokens.js';

export function Shell({ tableId, children }: { tableId?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const skin = useSkin();
  const appearance = useAppearance();
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
          <label>
            Skin
            <select
              value={appearance.skinId}
              onChange={(event) => appearance.setSkinId(event.target.value as SkinTokens['id'])}
            >
              {Object.values(SKINS).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.icon} {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="chip-visual-toggle">
            <input
              type="checkbox"
              checked={appearance.chipVisual}
              onChange={(event) => appearance.setChipVisual(event.target.checked)}
            />
            Chip stacks
          </label>
        </nav>
      ) : null}
      {children}
    </div>
  );
}
