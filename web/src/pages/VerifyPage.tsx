import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Api } from '../api.js';

export function VerifyPage({
  api,
  onSession,
}: {
  api: Api;
  onSession: (token: string) => void;
}) {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [requiresTerms, setRequiresTerms] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      return;
    }
    api
      .inspectVerify(token)
      .then((peek) => {
        setEmail(peek.email ?? '');
        setRequiresTerms(peek.requiresTerms);
      })
      .catch((err: Error) => setError(err.message));
  }, [token, api]);

  return (
    <main>
      <h1>Join JetonBro</h1>
      <p>{email ? `Continue as ${email}` : 'Confirm this invite'}</p>
      {requiresTerms ? (
        <label>
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          I accept the terms
        </label>
      ) : null}
      <button
        type="button"
        disabled={requiresTerms && !accepted}
        onClick={() => {
          api
            .completeVerify(token, accepted || !requiresTerms)
            .then((result) => {
              onSession(result.sessionToken);
              navigate('/');
            })
            .catch((err: Error) => setError(err.message));
        }}
      >
        Continue
      </button>
      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}
