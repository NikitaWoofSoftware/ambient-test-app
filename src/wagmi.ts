import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { swell } from './chains';
import { http } from 'viem';

export const config = getDefaultConfig({
  appName: 'Ambient DEX Demo',
  projectId: '427e30b4efbb68e836c169bd764b35a0', // WalletConnect project ID
  chains: [swell], // Only include Swell chain
  transports: {
    [swell.id]: http(swell.rpcUrls.default.http[0]),
  },
  enableTheming: false,
});