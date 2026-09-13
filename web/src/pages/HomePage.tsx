import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Api } from '../api.js';

export function HomePage({ api, hasSession }: { api: Api; hasSession: boolean }) {
  const [email, setEmail] = useState('');
  const [protocolId, setProtocolId] = useState('blackjack');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  return (
    <main>
      <h1>JetonBro</h1>
      {!hasSession ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            api
              .requestMagicLink(email)
              .then((result) => {
                if (result.emailed || !result.token) {
                  setMessage('Check your email for the sign-in link.');
                  return;
                }
                navigate(`/verify?token=${encodeURIComponent(result.token)}`);
              })
              .catch((err: Error) => setMessage(err.message));
          }}
        >
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <button type="submit">Send magic link</button>
        </form>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            api
              .createTable(protocolId)
              .then((table) => navigate(`/table/${table.id}`))
              .catch((err: Error) => setMessage(err.message));
          }}
        >
          <label>
            Protocol
            <select value={protocolId} onChange={(event) => setProtocolId(event.target.value)}>
              <option value="blackjack">Blackjack</option>
              <option value="poker">Poker</option>
              <option value="zilch">Zilch</option>
            </select>
          </label>
          <button type="submit">Create table</button>
        </form>
      )}
      {message ? <p>{message}</p> : null}
    </main>
  );
}
