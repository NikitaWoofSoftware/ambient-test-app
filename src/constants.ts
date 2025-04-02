/*****************************
 * FILE: src/constants.ts
 *****************************/
import { ZeroAddress } from 'ethers';

// --- Network & Contract Addresses ---
export const SWEL_CHAIN_ID = 1923;
export const SWEL_RPC_URL = 'https://swell-mainnet.alt.technology';
export const SWEL_EXPLORER_URL = 'https://swellexplorer.xyz';
// Ambient CrocSwap DEX address on Swell
export const AMBIENT_DEX_ADDRESS = "0xaAAaAaaa82812F0a1f274016514ba2cA933bF24D";

// --- Token Addresses on Swell ---
// Native ETH representation
export const ETH_ADDRESS = ZeroAddress; // 0x000...000
export const ETH_SYMBOL = "ETH";
export const NATIVE_DECIMALS = 18;

// KING Token on Swell
export const KING_SWELL_ADDRESS = "0xc2606aade4bdd978a4fa5a6edb3b66657acee6f8";
export const KING_SWELL_SYMBOL = "KING";
export const KING_SWELL_DECIMALS = 18; // Assuming KING has 18 decimals

// --- Default Values for UI ---
export const DEFAULT_SWAP_AMOUNT = "0.01";
export const DEFAULT_LIQUIDITY_AMOUNT = "0.005"; // Smaller amount for liquidity tests
export const DEFAULT_SLIPPAGE = 0.01; // 1% slippage tolerance

// Default token pair for examples
export const DEFAULT_TOKEN_BASE_ADDRESS = ETH_ADDRESS;
export const DEFAULT_TOKEN_BASE_SYMBOL = ETH_SYMBOL;
export const DEFAULT_TOKEN_BASE_DECIMALS = NATIVE_DECIMALS;

export const DEFAULT_TOKEN_QUOTE_ADDRESS = KING_SWELL_ADDRESS;
export const DEFAULT_TOKEN_QUOTE_SYMBOL = KING_SWELL_SYMBOL;
export const DEFAULT_TOKEN_QUOTE_DECIMALS = KING_SWELL_DECIMALS;

// Tick spacing commonly used in Ambient
export const DEFAULT_TICK_SPACING = 60;

// WalletConnect Project ID (Replace with your own if needed)
export const WALLETCONNECT_PROJECT_ID = '427e30b4efbb68e836c169bd764b35a0';

