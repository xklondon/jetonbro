import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Api } from '../api.js';

export function InviteLandingPage({ api }: { api: Api }) {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [channel, setChannel] = useState('');

  useEffect(() => {
    api
      .previewInvite(token)
      .then((preview) => {
        setChannel(preview.channel);
        if (!preview.requiresContact) {
          return;
        }
      })
      .catch((err: Error) => setError(err.message));
  }, [token, api]);

  return (
    <main>
      <h1>Join the table</h1>
      <p className="muted">{channel ? `${channel} invite` : 'Loading invite…'}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          api
            .requestMagicLink(email, token)
            .then((result) => {
              if (result.emailed || !result.token) {
                setNote('Check your email for the sign-in link.');
                return;
              }
              navigate(`/verify?token=${encodeURIComponent(result.token)}`);
            })
            .catch((err: Error) => setError(err.message));
        }}
      >
        <label>
          Email or phone
          <input value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <button type="submit">Continue</button>
      </form>
      {note ? <p>{note}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}
