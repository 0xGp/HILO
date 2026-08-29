import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig, robinhoodTestnet } from './chain';

const queryClient = new QueryClient();

export default function Providers({ children }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={robinhoodTestnet}
          theme={darkTheme({
            accentColor: '#d6c4a1',
            accentColorForeground: '#0a0a0a',
            borderRadius: 'large',
            overlayBlur: 'small'
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
