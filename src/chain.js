import { defineChain } from 'viem';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  coinbaseWallet,
  rabbyWallet
} from '@rainbow-me/rainbowkit/wallets';
import { http } from 'wagmi';

export const RH_RPC = 'https://rpc.testnet.chain.robinhood.com';
export const RH_EXPLORER = 'https://explorer.testnet.chain.robinhood.com';
export const RH_CHAIN_ID = 46630;
export const RH_CHAIN_HEX = '0xb616';

export const robinhoodTestnet = defineChain({
  id: RH_CHAIN_ID,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [RH_RPC] }
  },
  blockExplorers: {
    default: {
      name: 'Robinhood Explorer',
      url: RH_EXPLORER
    }
  },
  testnet: true
});

export const robinhoodWalletChain = {
  chainId: RH_CHAIN_HEX,
  chainName: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: [RH_RPC],
  blockExplorerUrls: [RH_EXPLORER]
};

/** Robinhood testnet posts ~0.01 gwei. Wallets often over-quote EIP-1559 and then say gas is not enough. */
export const RH_GAS_PRICE = 10_000_000n;
export const MIN_GAS_ETH = 50_000_000_000_000n; // 0.00005 ETH

export function rhTx(gasLimit) {
  return {
    chainId: robinhoodTestnet.id,
    type: 'legacy',
    gasPrice: RH_GAS_PRICE,
    gas: gasLimit
  };
}

const projectId =
  import.meta.env.VITE_WC_PROJECT_ID || '21fef48091f7f4f8b560a06fc1caacf7';

const appOrigin =
  typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

export const wagmiConfig = getDefaultConfig({
  appName: 'HILO',
  appDescription: 'HILO — higher or lower',
  appUrl: appOrigin,
  projectId,
  ssr: false,
  chains: [robinhoodTestnet],
  transports: {
    [robinhoodTestnet.id]: http(RH_RPC)
  },
  // Injected wallets only — WalletConnect / Reown origin allowlist
  // (cloud.reown.com) is not used, so localhost and every route work.
  wallets: [
    {
      groupName: 'Installed',
      wallets: [injectedWallet, metaMaskWallet, rainbowWallet, rabbyWallet, coinbaseWallet]
    }
  ],
  walletConnectParameters: {
    metadata: {
      name: 'HILO',
      description: 'HILO — higher or lower',
      url: appOrigin,
      icons: []
    }
  }
});
