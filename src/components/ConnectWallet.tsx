/*****************************
 * FILE: src/components/ConnectWallet.tsx
 *****************************/

import { ConnectButton } from '@rainbow-me/rainbowkit';

export function ConnectWallet() {
  return (
    // Removed the outer div, ConnectButton handles its own layout reasonably
    <>
        <ConnectButton showBalance={true} chainStatus="icon" accountStatus="address" />
        {/* You can add explanatory text outside the button if needed */}
        {/* <p style={{ fontSize: '0.8rem', marginTop: '4px', textAlign: 'center' }}>
            Click address to see options or disconnect.
        </p> */}
    </>
  );
}

