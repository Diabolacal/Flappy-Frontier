import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { createNetworkConfig } from '@mysten/dapp-kit';
import { CONTRACT_CONFIG } from '@/lib/contractConfig';
import '@mysten/dapp-kit/dist/index.css';

const { networkConfig } = createNetworkConfig({
  testnet: { url: CONTRACT_CONFIG.rpcUrl, network: 'testnet' },
});

const queryClient = new QueryClient();

// Wallet preference ordering for the ConnectModal (browser fallback).
// EVE Vault is listed first since it's the primary browser wallet.
// In SSU, the generic ConnectModal is bypassed entirely via useSSUWallet.
const preferredWallets = ['EVE Vault', 'EVE Frontier Client Wallet'];

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect={false} preferredWallets={preferredWallets}>
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
