import { ConnectButton } from '@rainbow-me/rainbowkit';

export function ConnectWallet() {
  return (
    <div className="wallet-controls">
      <div style={{ margin: "0 auto" }}>
        <ConnectButton showBalance={true} />
      </div>
      <p style={{ fontSize: '0.8rem', marginTop: '4px', textAlign: 'center' }}>
        Click your account to disconnect
      </p>
    </div>
  );
}