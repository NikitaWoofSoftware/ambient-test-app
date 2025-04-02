/*****************************
 * FILE: src/chains.ts
 *****************************/

import { type Chain } from 'viem';
import { SWEL_CHAIN_ID, SWEL_EXPLORER_URL, SWEL_RPC_URL } from './constants';

export const swell = {
  id: SWEL_CHAIN_ID,
  name: 'Swell Chain',
  network: 'swell', // Keep network name simple for SDK compatibility if needed
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [SWEL_RPC_URL, 'https://rpc.swellnetwork.xyz'] }, // Provide fallback
    public: { http: [SWEL_RPC_URL, 'https://rpc.swellnetwork.xyz'] },
  },
  blockExplorers: {
    default: { name: 'SwellScan', url: SWEL_EXPLORER_URL },
  },
  testnet: false,
} as const satisfies Chain;

