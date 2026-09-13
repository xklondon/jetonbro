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
  const [tableId, setTableId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      return;
    }
    api
      .inspectVerify(token)
      .then((peek) => {
        setEmail(peek.email ?? '');
        setTableId(peek.tableId);
      })
      .catch((err: Error) => setError(err.message));
  }, [token, api]);

  return (
    <main>
      <h1>Join JetonBro</h1>
      <p>{email ? `Continue as ${email}` : 'Confirm this invite'}</p>
      <button
        type="button"
        onClick={() => {
          api
            .completeVerify(token)
            .then((result) => {
              onSession(result.sessionToken);
              navigate(result.tableId ? `/table/${result.tableId}` : tableId ? `/table/${tableId}` : '/');
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
