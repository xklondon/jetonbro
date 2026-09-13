import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { AllowedAction, Api, TableSnapshot } from '../api.js';
import { ActionBar } from '../components/ActionBar.js';
import { HandDisplayField } from '../components/HandDisplayField.js';
import { StackAndPot } from '../components/StackAndPot.js';

export function TablePage({ api, onTable }: { api: Api; onTable?: (id: string) => void }) {
  const { tableId = '' } = useParams();
  const [snapshot, setSnapshot] = useState<TableSnapshot | null>(null);
  const [amount, setAmount] = useState('10');
  const [boxId, setBoxId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [outcome, setOutcome] = useState('win');
  const [error, setError] = useState('');

  async function refresh() {
    setSnapshot(await api.snapshot(tableId));
  }

  useEffect(() => {
    onTable?.(tableId);
    refresh().catch((err: Error) => setError(err.message));
  }, [tableId]);

  async function run(action: AllowedAction) {
    setError('');
    try {
      const body: Record<string, unknown> = { actionId: action.id };
      if (action.locksChips || action.creditsGame) {
        body.amount = Number(amount);
      }
      if (action.requiresBox && (boxId || snapshot?.boxes[0]?.id)) {
        body.boxId = boxId || snapshot?.boxes[0]?.id;
      }
      if (action.creditsGame) {
        body.targetUserId = targetUserId || snapshot?.players[0]?.id;
      }
      if (action.resolvesPot) {
        body.outcome = outcome;
        body.winners = [snapshot?.viewer.id];
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

  return (
    <main>
      <header className="page-head">
        <p className="eyebrow">
          {snapshot.protocolId} · {snapshot.phase}
        </p>
        <h1>Table</h1>
        {snapshot.settingsAccess ? <p className="muted">Settings available (owner)</p> : null}
        <p className="muted">You: {snapshot.viewer.roles.join(', ') || 'viewer'}</p>
      </header>
      <StackAndPot snapshot={snapshot} />
      <label>
        Amount
        <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" />
      </label>
      {snapshot.boxes.length > 1 ? (
        <label>
          Box
          <select value={boxId} onChange={(event) => setBoxId(event.target.value)}>
            <option value="">Your box</option>
            {snapshot.boxes.map((box) => (
              <option key={box.id} value={box.id}>
                {box.ownerUserId === snapshot.viewer.id ? 'Yours' : box.ownerUserId} · {box.stake}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {snapshot.viewer.allowedActions.some((action) => action.creditsGame) ? (
        <label>
          Credit player
          <select value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)}>
            {snapshot.players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {snapshot.viewer.allowedActions.some((action) => action.resolvesPot) ? (
        <label>
          Outcome
          <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
            <option value="win">Win</option>
            <option value="blackjack">Blackjack</option>
            <option value="push">Push</option>
            <option value="lose">Lose</option>
          </select>
        </label>
      ) : null}
      <ActionBar actions={snapshot.viewer.allowedActions} onAction={(action) => void run(action)} />
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
