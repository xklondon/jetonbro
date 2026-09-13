import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { AllowedAction, Api, TableSnapshot } from '../api.js';
import { ActionBar } from '../components/ActionBar.js';
import { HandDisplayField } from '../components/HandDisplayField.js';
import { ResolutionBoard } from '../components/ResolutionBoard.js';
import { SetupPanel, StartBettingButton } from '../components/SetupPanel.js';
import { StackAndPot } from '../components/StackAndPot.js';

const HIDDEN_ACTIONS = new Set(['assign-bank', 'open-betting', 'declare-outcome']);

export function TablePage({ api, onTable }: { api: Api; onTable?: (id: string) => void }) {
  const { tableId = '' } = useParams();
  const [snapshot, setSnapshot] = useState<TableSnapshot | null>(null);
  const [amount, setAmount] = useState('10');
  const [boxId, setBoxId] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    setSnapshot(await api.snapshot(tableId));
  }

  useEffect(() => {
    onTable?.(tableId);
    refresh().catch((err: Error) => setError(err.message));
    const tick = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(tick);
  }, [tableId]);

  async function run(action: AllowedAction) {
    setError('');
    try {
      const body: Record<string, unknown> = { actionId: action.id };
      if (action.locksChips) {
        body.amount = Number(amount);
      }
      if (action.requiresBox && (boxId || snapshot?.boxes[0]?.id)) {
        body.boxId = boxId || snapshot?.boxes[0]?.id;
      }
      setSnapshot(await api.act(tableId, body));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  if (!snapshot) {
    return <p>{error || 'Loading table…'}</p>;
  }

  const showHand =
    snapshot.phase === 'resolution' ||
    snapshot.phase === 'showdown' ||
    snapshot.viewer.allowedActions.some((action) => action.id === 'attach-hand-display');
  const canEditHand = snapshot.viewer.allowedActions.some((action) => action.id === 'attach-hand-display');
  const visibleActions = snapshot.viewer.allowedActions.filter((action) => !HIDDEN_ACTIONS.has(action.id));
  const needsAmount = visibleActions.some((action) => action.locksChips);
  const canStart = snapshot.viewer.allowedActions.some((action) => action.id === 'open-betting');
  const showResolutionBoard =
    snapshot.payoutRule === 'multiplier' &&
    snapshot.viewer.allowedActions.some((action) => action.id === 'declare-outcome');

  return (
    <main>
      <header className="page-head">
        <p className="eyebrow">
          {snapshot.protocolId} · {snapshot.phase}
        </p>
        <h1>Table</h1>
        <p className="muted">You: {snapshot.viewer.roles.join(', ') || 'viewer'}</p>
      </header>
      {snapshot.phase === 'setup' && snapshot.settingsAccess ? (
        <SetupPanel api={api} snapshot={snapshot} onSnapshot={setSnapshot} onError={setError} />
      ) : null}
      {snapshot.phase === 'setup' && !snapshot.settingsAccess && canStart ? (
        <StartBettingButton
          onStart={() => {
            void run({
              id: 'open-betting',
              label: 'Start betting',
              locksChips: false,
              requiresBox: false,
              resolvesPot: false,
            });
          }}
        />
      ) : null}
      <StackAndPot snapshot={snapshot} />
      {needsAmount ? (
        <label>
          Amount
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" />
        </label>
      ) : null}
      {snapshot.boxes.length > 1 && visibleActions.some((action) => action.requiresBox) ? (
        <label>
          Box
          <select value={boxId} onChange={(event) => setBoxId(event.target.value)}>
            <option value="">Your box</option>
            {snapshot.boxes.map((box) => (
              <option key={box.id} value={box.id}>
                {box.ownerUserId === snapshot.viewer.id ? 'Yours' : box.ownerLabel} · {box.stake}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {showResolutionBoard ? (
        <ResolutionBoard api={api} snapshot={snapshot} onSnapshot={setSnapshot} onError={setError} />
      ) : null}
      {visibleActions.length > 0 || snapshot.phase !== 'setup' ? (
        <ActionBar actions={visibleActions} onAction={(action) => void run(action)} />
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {showHand
        ? snapshot.players.map((player) => (
            <HandDisplayField
              key={player.id}
              text={player.handDisplay.text}
              photo={player.handDisplay.photo}
              editable={canEditHand && player.id === snapshot.viewer.id}
              onSave={(next) => {
                void api.setHandDisplay(tableId, next).then(setSnapshot);
              }}
            />
          ))
        : null}
      <p>
        <Link to="/wallet">Wallet</Link> · <Link to="/standings">Standings</Link>
      </p>
    </main>
  );
}
