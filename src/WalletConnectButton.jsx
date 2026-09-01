import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function WalletConnectButton({ className = '' }) {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;
        const cls = `wallet-connect-btn${className ? ` ${className}` : ''}`;

        if (!ready) {
          return (
            <button type="button" className={cls} disabled aria-hidden>
              <span className="wallet-connect-edge tl" aria-hidden="true" />
              <span className="wallet-connect-edge br" aria-hidden="true" />
              Connect wallet
            </button>
          );
        }

        if (!connected) {
          return (
            <button type="button" className={cls} onClick={openConnectModal}>
              <span className="wallet-connect-edge tl" aria-hidden="true" />
              <span className="wallet-connect-edge br" aria-hidden="true" />
              Connect wallet
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button type="button" className={`${cls} is-error`} onClick={openChainModal}>
              <span className="wallet-connect-edge tl" aria-hidden="true" />
              <span className="wallet-connect-edge br" aria-hidden="true" />
              Wrong network
            </button>
          );
        }

        return (
          <button type="button" className={`${cls} is-connected`} onClick={openAccountModal}>
            <span className="wallet-connect-edge tl" aria-hidden="true" />
            <span className="wallet-connect-edge br" aria-hidden="true" />
            <span className="wallet-connect-dot" aria-hidden="true" />
            {account.displayName}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
