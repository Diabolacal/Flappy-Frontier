import { GamePage } from '@/features/game/components/GamePage';
import { Providers } from './Providers';
import { useSSUWallet } from '@/features/auth/hooks/useSSUWallet';

function AppContent() {
  const ssuWallet = useSSUWallet();
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
