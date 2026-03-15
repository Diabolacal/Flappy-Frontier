import { GamePage } from '@/features/game/components/GamePage';
import { Providers } from './Providers';
import { NarrowScreenGate } from './NarrowScreenGate';
import { useSSUWallet } from '@/features/auth/hooks/useSSUWallet';
import { useIsMobileNarrow } from '@/lib/useIsNarrowScreen';

function AppContent() {
  const ssuWallet = useSSUWallet();
  const isMobileNarrow = useIsMobileNarrow();

  if (isMobileNarrow && !ssuWallet.isSSU && ssuWallet.status !== 'detecting') {
    return <NarrowScreenGate />;
  }

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-black overflow-hidden">
      <GamePage ssuWallet={ssuWallet} />
    </div>
  );
}

export default function App() {
  return (
    <Providers>
      <AppContent />
    </Providers>
  );
}
