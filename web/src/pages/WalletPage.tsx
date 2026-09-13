import { useEffect, useState } from 'react';
import type { Api } from '../api.js';
import { ChipPile } from '../components/StackAndPot.js';
import { useAppearance } from '../theme/ThemeProvider.js';

export function WalletPage({ api }: { api: Api }) {
  const [balance, setBalance] = useState<number | null>(null);
  const { chipVisual } = useAppearance();

  useEffect(() => {
    api.me().then((me) => setBalance(me.wallet?.balance ?? 0)).catch(() => setBalance(0));
  }, [api]);

  return (
    <main>
      <h1>Wallet</h1>
      {balance == null ? (
        <p data-testid="master-balance">Master: …</p>
      ) : (
        <ChipPile
          testId="master-balance"
          label="Master"
          amount={balance}
          kind="stack"
          chipVisual={chipVisual}
        />
      )}
    </main>
  );
}
