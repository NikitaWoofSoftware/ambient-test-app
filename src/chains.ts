import { type Chain } from 'viem';

export const swell = {
  id: 1923,
  name: 'Swell Chain',
  network: 'swell',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [
      'https://swell-mainnet.alt.technology', 
      'https://rpc.swellnetwork.xyz'
    ] },
    public: { http: [
      'https://swell-mainnet.alt.technology', 
      'https://rpc.swellnetwork.xyz'
    ] },
  },
  blockExplorers: {
    default: { name: 'SwellScan', url: 'https://swellexplorer.xyz' },
  },
  testnet: false,
} as const satisfies Chain;