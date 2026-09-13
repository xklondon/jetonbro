/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);
import { MemoryRouter } from 'react-router-dom';
import { ActionBar } from './components/ActionBar.js';
import { ResolutionBoard } from './components/ResolutionBoard.js';
import { SetupPanel } from './components/SetupPanel.js';
import { HandDisplayField } from './components/HandDisplayField.js';
import { StackAndPot } from './components/StackAndPot.js';
import { HomePage } from './pages/HomePage.js';
import { StandingsPage } from './pages/StandingsPage.js';
import { ThemeProvider } from './theme/ThemeProvider.js';
import { ChipPile } from './components/StackAndPot.js';
import { applySkinTokens, CASINO_SKIN } from './theme/tokens.js';
import type { TableSnapshot } from './api.js';

const snapshot = (over: Partial<TableSnapshot> = {}): TableSnapshot => ({
  tableId: 't1',
  protocolId: 'blackjack',
  phase: 'betting-open',
  flags: {},
  boxes: [],
  pot: { amount: 0 },
  authorityUserId: 'bank',
  multipliers: { win: 2, blackjack: 2.5, push: 1, lose: 0 },
  currentTurnUserId: 'p1',
  settingsAccess: true,
  payoutRule: 'multiplier',
  viewer: {
    id: 'p1',
    label: 'p1',
    roles: ['player'],
    stack: 40,
    masterBalance: 0,
    allowedActions: [{ id: 'bet', label: 'Bet', locksChips: true, requiresBox: false, resolvesPot: false }],
    handDisplay: { userId: 'p1', text: '', photo: '' },
  },
  players: [],
  invites: [],
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
          { id: 'close-betting', label: 'Close betting', locksChips: false, requiresBox: false, resolvesPot: false },
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

  it('stays on home and asks to check email when the magic link was mailed', async () => {
    const api = {
      requestMagicLink: vi.fn().mockResolvedValue({ emailed: true }),
    };
    render(
      <MemoryRouter>
        <HomePage api={api as never} hasSession={false} />
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText('Email'), 'host@t.test');
    await userEvent.click(screen.getByRole('button', { name: 'Send magic link' }));
    expect(await screen.findByText('Check your email for the sign-in link.')).toBeTruthy();
  });

  it('lets the owner add a player and lists them as pending', async () => {
    const created = {
      tableId: 't1',
      invites: [
        {
          id: 'inv1',
          channel: 'email',
          label: 'ada@t.test',
          openingChips: 40,
          status: 'pending' as const,
          claimedByUserId: null,
          joinPath: '/verify?token=abc',
          shareUrl: null,
        },
      ],
    };
    const api = {
      createInvite: vi.fn().mockResolvedValue({ token: 'inv', magicToken: 'abc', joinPath: '/verify?token=abc', shareUrl: null }),
      snapshot: vi.fn().mockResolvedValue(snapshot(created)),
    };
    render(
      <SetupPanel
        api={api as never}
        snapshot={snapshot({ settingsAccess: true, phase: 'setup' })}
        onSnapshot={vi.fn()}
        onError={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Add player' })).toBeTruthy();
    expect(screen.queryByText('Top up existing player')).toBeNull();
    expect(screen.queryByText('Assign chips')).toBeNull();
    expect(screen.queryByText('Credit player')).toBeNull();
    await userEvent.type(screen.getByLabelText('Email'), 'ada@t.test');
    await userEvent.clear(screen.getByLabelText('Starting chips'));
    await userEvent.type(screen.getByLabelText('Starting chips'), '40');
    await userEvent.click(screen.getByRole('button', { name: 'Add player' }));
    expect(api.createInvite).toHaveBeenCalledWith('t1', {
      channel: 'email',
      email: 'ada@t.test',
      openingChips: 40,
    });
  });

  it('lets the owner mark one joined player Bank (radio)', async () => {
    const api = { act: vi.fn().mockResolvedValue(snapshot()), snapshot: vi.fn() };
    render(
      <SetupPanel
        api={api as never}
        snapshot={snapshot({
          phase: 'setup',
          settingsAccess: true,
          authorityUserId: null,
          viewer: {
            ...snapshot().viewer,
            allowedActions: [{ id: 'assign-bank', label: 'Assign bank', locksChips: false, requiresBox: false, resolvesPot: false }],
          },
          players: [{ id: 'p2', label: 'ada@t.test', stack: 40, handDisplay: { userId: 'p2', text: '', photo: '' } }],
          invites: [
            {
              id: 'inv1',
              channel: 'email',
              label: 'ada@t.test',
              openingChips: 40,
              status: 'joined',
              claimedByUserId: 'p2',
              joinPath: null,
              shareUrl: null,
            },
          ],
        })}
        onSnapshot={vi.fn()}
        onError={vi.fn()}
      />,
    );
    await userEvent.click(screen.getAllByLabelText('Bank')[0]!);
    expect(api.act).toHaveBeenCalledWith('t1', { actionId: 'assign-bank', targetUserId: 'p2' });
    expect(screen.queryByRole('button', { name: 'Start betting' })).toBeNull();
  });

  it('shows every locked box to Bank with a suggested payout', async () => {
    const api = { act: vi.fn().mockResolvedValue(snapshot()) };
    render(
      <ResolutionBoard
        api={api as never}
        snapshot={snapshot({
          phase: 'resolution',
          boxes: [
            {
              id: 'b1',
              ownerUserId: 'p2',
              ownerLabel: 'ada@t.test',
              stake: 10,
              status: 'locked',
              escrowState: 'LOCKED',
              outcome: null,
              suggestedPayout: null,
            },
          ],
        })}
        onSnapshot={vi.fn()}
        onError={vi.fn()}
      />,
    );
    expect(screen.getByText(/ada@t.test · 10 locked/)).toBeTruthy();
    await userEvent.click(screen.getByLabelText('Lose'));
    expect(screen.getByText('Suggested 0 (editable before release)')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm release' }));
    expect(api.act).toHaveBeenCalledWith('t1', {
      actionId: 'declare-outcome',
      boxId: 'b1',
      outcome: 'lose',
      payoutAmount: 0,
    });
  });

  it('does not hardcode Simple colors — extra skins restyle the same piles', () => {
    const root = document.createElement('div');
    applySkinTokens(root, CASINO_SKIN);
    expect(root.style.getPropertyValue('--skin-pot')).toBe(CASINO_SKIN.pot);
    expect(root.style.getPropertyValue('--skin-stack')).toBe(CASINO_SKIN.stack);
    render(
      <ThemeProvider tokens={CASINO_SKIN}>
        <StackAndPot snapshot={snapshot({ pot: { amount: 7 } })} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('pot-pile').getAttribute('data-amount')).toBe('7');
  });

  it('chip-visual mode draws denoms from the same pile integer, not a second pot', () => {
    render(<ChipPile testId="pot-pile" label="Pot" amount={40} kind="pot" chipVisual />);
    expect(screen.getByTestId('pot-pile').getAttribute('data-amount')).toBe('40');
    expect(screen.getByTestId('pot-pile').querySelector('[data-denom="25"]')?.getAttribute('data-count')).toBe(
      '1',
    );
    expect(screen.getByTestId('pot-pile').querySelector('[data-denom="10"]')?.getAttribute('data-count')).toBe(
      '1',
    );
    expect(screen.getByTestId('pot-pile').querySelector('[data-denom="5"]')?.getAttribute('data-count')).toBe(
      '1',
    );
  });
});
