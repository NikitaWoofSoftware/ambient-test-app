/*****************************
 * FILE: src/wagmi.ts
 *****************************/

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'viem';
import { swell } from './chains'; // Import chain config
import { WALLETCONNECT_PROJECT_ID } from './constants'; // Import Project ID

// Ensure the project ID is defined
if (!WALLETCONNECT_PROJECT_ID) {
    console.error("WalletConnect Project ID is not defined in constants.ts!");
    alert("WalletConnect Project ID is missing. Please check configuration.");
}

export const config = getDefaultConfig({
  appName: 'Ambient DEX Demo (Swell)', // More specific name
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [swell], // Only Swell chain
  transports: {
    // Use the default RPC URL from the chain config
    [swell.id]: http(swell.rpcUrls.default.http[0]),
  },
  // Optional: Add wallet specific settings or configurations if needed
  // wallets: [ ... ],
  // appInfo: { ... },

  // Explicitly disable theming if you handle it all via CSS
  // enableTheming: false, // Let RainbowKitProvider handle theme for consistency
});

