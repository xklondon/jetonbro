import { useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { createApi } from './api.js';
import { Shell } from './components/Shell.js';
import { EightBallPage } from './pages/fun/EightBallPage.js';
import { RedCardPage, YellowCardPage } from './pages/fun/RefereeCardPage.js';
import { FunPage } from './pages/FunPage.js';
import { HomePage } from './pages/HomePage.js';
import { InviteLandingPage } from './pages/InviteLandingPage.js';
import { StandingsPage } from './pages/StandingsPage.js';
import { TablePage } from './pages/TablePage.js';
import { VerifyPage } from './pages/VerifyPage.js';
import { WalletPage } from './pages/WalletPage.js';
import { ThemeProvider } from './theme/ThemeProvider.js';

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
    <ThemeProvider>
      <Shell tableId={tableId}>
        <Routes>
          <Route path="/" element={<HomePage api={api} hasSession={Boolean(session)} />} />
          <Route path="/verify" element={<VerifyPage api={api} onSession={onSession} />} />
          <Route path="/invite/:token" element={<InviteLandingPage api={api} />} />
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
          <Route path="/fun/yellow" element={<YellowCardPage />} />
          <Route path="/fun/red" element={<RedCardPage />} />
          <Route path="/fun/eight-ball" element={<EightBallPage />} />
        </Routes>
      </Shell>
    </ThemeProvider>
  );
}
