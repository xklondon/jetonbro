/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);
import { MemoryRouter } from 'react-router-dom';
import { ActionBar } from './components/ActionBar.js';
import { HandDisplayField } from './components/HandDisplayField.js';
import { StackAndPot } from './components/StackAndPot.js';
import { StandingsPage } from './pages/StandingsPage.js';
import { ThemeProvider } from './theme/ThemeProvider.js';
import { applySkinTokens, SIMPLE_SKIN, type SkinTokens } from './theme/tokens.js';
import type { TableSnapshot } from './api.js';

const snapshot = (over: Partial<TableSnapshot> = {}): TableSnapshot => ({
  tableId: 't1',
  protocolId: 'blackjack',
  phase: 'betting-open',
  flags: {},
  boxes: [],
  pot: { amount: 0 },
  authorityUserId: 'bank',
  currentTurnUserId: 'p1',
  settingsAccess: true,
  payoutRule: 'multiplier',
  viewer: {
    id: 'p1',
    label: 'p1',
    roles: ['player'],
    stack: 40,
    masterBalance: 0,
    allowedActions: [{ id: 'bet', label: 'Bet', locksChips: true, requiresBox: false, creditsGame: false, resolvesPot: false }],
    handDisplay: { userId: 'p1', text: '', photo: '' },
  },
  players: [],
  ...over,
});

describe('core UI', () => {
  it('sizes stack and pot from the same snapshot the lock/release wrote', () => {
    const { rerender } = render(
      <ThemeProvider>
        <StackAndPot snapshot={snapshot({ pot: { amount: 0 }, viewer: { ...snapshot().viewer, stack: 50 } })} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('stack-pile').getAttribute('data-amount')).toBe('50');
    expect(screen.getByTestId('pot-pile').getAttribute('data-amount')).toBe('0');

    rerender(
      <ThemeProvider>
        <StackAndPot snapshot={snapshot({ pot: { amount: 10 }, viewer: { ...snapshot().viewer, stack: 40 } })} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('stack-pile').getAttribute('data-amount')).toBe('40');
    expect(screen.getByTestId('pot-pile').getAttribute('data-amount')).toBe('10');
  });

  it('shows only the phase- and role-gated actions from the snapshot', async () => {
    const onAction = vi.fn();
    render(
      <ActionBar
        actions={[
          { id: 'close-betting', label: 'Close betting', locksChips: false, requiresBox: false, creditsGame: false, resolvesPot: false },
        ]}
        onAction={onAction}
      />,
    );
    expect(screen.getByRole('button', { name: 'Close betting' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bet' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Double' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Close betting' }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'close-betting' }));
  });

  it('renders the hand field as typed, without scoring', () => {
    render(<HandDisplayField text="A♥ K♥" photo="" editable={false} />);
    expect(screen.getByTestId('hand-text').textContent).toBe('A♥ K♥');
  });

  it('wires Standings Save and Clear to the ledger API', async () => {
    const api = {
      me: vi.fn().mockResolvedValue({ user: { id: 'me', email: 'me@t.test' }, wallet: { balance: 0 }, tableIds: [] }),
      standings: vi.fn().mockResolvedValue({
        rows: [
          {
            otherUserId: 'bob',
            otherLabel: 'bob@t.test',
            standing: { status: 'owes', owes: 'me', amount: 20 },
          },
        ],
      }),
      saveStandings: vi.fn().mockResolvedValue({}),
      clearStandings: vi.fn().mockResolvedValue({}),
    };
    render(
      <MemoryRouter>
        <StandingsPage api={api as never} />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/You owe bob@t.test 20/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(api.saveStandings).toHaveBeenCalledWith('bob');
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(api.clearStandings).toHaveBeenCalledWith('bob');
  });

  it('does not hardcode Simple colors — extra skins restyle the same piles', () => {
    const casino: SkinTokens = { ...SIMPLE_SKIN, id: 'casino', name: 'Casino', icon: '♠', pot: '#ff0', stack: '#0f0' };
    const root = document.createElement('div');
    applySkinTokens(root, casino);
    expect(root.style.getPropertyValue('--skin-pot')).toBe('#ff0');
    expect(root.style.getPropertyValue('--skin-stack')).toBe('#0f0');
    render(
      <ThemeProvider tokens={casino}>
        <StackAndPot snapshot={snapshot({ pot: { amount: 7 } })} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('pot-pile').getAttribute('data-amount')).toBe('7');
  });
});
