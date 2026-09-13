import { useEffect, useState } from 'react';
import type { Api } from '../api.js';

export function WalletPage({ api }: { api: Api }) {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    api.me().then((me) => setBalance(me.wallet?.balance ?? 0)).catch(() => setBalance(0));
  }, [api]);

  return (
    <main>
      <h1>Wallet</h1>
      <p data-testid="master-balance">Master: {balance ?? '…'}</p>
    </main>
  );
}
