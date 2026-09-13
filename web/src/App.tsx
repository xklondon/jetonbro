import { useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { createApi } from './api.js';
import { Shell } from './components/Shell.js';
import { FunPage } from './pages/FunPage.js';
import { HomePage } from './pages/HomePage.js';
import { StandingsPage } from './pages/StandingsPage.js';
import { TablePage } from './pages/TablePage.js';
import { VerifyPage } from './pages/VerifyPage.js';
import { WalletPage } from './pages/WalletPage.js';
import { ThemeProvider } from './theme/ThemeProvider.js';
import { SIMPLE_SKIN } from './theme/tokens.js';

const TOKEN_KEY = 'jetonbro.session';

export function App({ apiFactory = createApi }: { apiFactory?: typeof createApi }) {
  const [session, setSession] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [tableId, setTableId] = useState<string | undefined>();
  const api = useMemo(() => apiFactory('', () => session), [apiFactory, session]);

  function onSession(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
    setSession(token);
  }

  return (
    <ThemeProvider tokens={SIMPLE_SKIN}>
      <Shell tableId={tableId}>
        <Routes>
          <Route path="/" element={<HomePage api={api} hasSession={Boolean(session)} />} />
          <Route path="/verify" element={<VerifyPage api={api} onSession={onSession} />} />
          <Route
            path="/table/:tableId"
            element={
              session ? <TablePage api={api} onTable={setTableId} /> : <Navigate to="/" replace />
            }
          />
          <Route path="/wallet" element={session ? <WalletPage api={api} /> : <Navigate to="/" replace />} />
          <Route
            path="/standings"
            element={session ? <StandingsPage api={api} /> : <Navigate to="/" replace />}
          />
          <Route path="/fun" element={<FunPage />} />
        </Routes>
      </Shell>
    </ThemeProvider>
  );
}
