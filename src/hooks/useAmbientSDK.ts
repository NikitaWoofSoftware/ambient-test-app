/*****************************
 * FILE: src/hooks/useAmbientSDK.ts
 *****************************/

import { useState, useEffect, useRef } from 'react';
import { type WalletClient, useWalletClient } from 'wagmi';
import { CrocEnv } from '@crocswap-libs/sdk';
import { BrowserProvider, JsonRpcSigner, type Provider } from 'ethers';
import { SWEL_CHAIN_ID } from '../constants';

// Convert Viem WalletClient to Ethers v6 Signer
// (Keep this function as it was in the previous working JSON version)
export async function walletClientToSigner(walletClient: WalletClient): Promise<JsonRpcSigner | null> {
  const { account, chain, transport } = walletClient;
  const logPrefix = "[walletClientToSigner]";

  if (!account || !chain || !transport) {
    console.warn(`${logPrefix} Missing account, chain, or transport.`, { account, chain, transport });
    return null;
  }

  if (chain.id !== SWEL_CHAIN_ID) {
    console.warn(`${logPrefix} Connected to wrong chain ID ${chain.id}, expected ${SWEL_CHAIN_ID}.`);
    return null; // Explicitly return null for wrong chain
  }

  try {
    console.info(`${logPrefix} Creating BrowserProvider for chain ${chain.id}...`);
    const provider: Provider = new BrowserProvider(transport, chain.id);
    console.info(`${logPrefix} Creating JsonRpcSigner for address ${account.address}...`);
    const signer = new JsonRpcSigner(provider, account.address);
    // Quick check if signer seems valid
    const signerAddr = await signer.getAddress();
    if (signerAddr.toLowerCase() !== account.address.toLowerCase()) {
      console.error(`${logPrefix} Signer address mismatch! Expected ${account.address}, got ${signerAddr}`);
      throw new Error("Signer address mismatch");
    }
    console.info(`${logPrefix} Successfully created Ethers v6 Signer for ${signerAddr}.`);
    return signer;
  } catch (error) {
    console.error(`${logPrefix} Error creating Ethers Signer:`, error);
    return null;
  }
}


type SdkState = {
  croc: CrocEnv | null;
  signer: JsonRpcSigner | null;
  ready: boolean;
  error: string | null;
  isLoading: boolean;
}

const initialState: SdkState = {
  croc: null,
  signer: null,
  ready: false,
  error: null,
  isLoading: false
};

export function useAmbientSDK() {
  const { data: walletClient, status: walletStatus } = useWalletClient();
  const [sdkState, setSdkState] = useState<SdkState>(initialState);
  // Ref to track if initialization is *actively* running
  const isInitializing = useRef(false);
  // Ref to store the latest walletClient to prevent stale closures
  const walletClientRef = useRef(walletClient);
  walletClientRef.current = walletClient; // Update ref on every render

  useEffect(() => {
    const effectId = Math.random().toString(36).substring(2, 7); // Unique ID for logging this run
    const logPrefix = `[useAmbientSDK Effect ${effectId}]`;

    // Use the current value from the ref inside the effect
    const currentWalletClient = walletClientRef.current;

    console.log(`${logPrefix} Running. Status: ${walletStatus}, WC available: ${!!currentWalletClient}, Ready: ${sdkState.ready}, isInitializingRef: ${isInitializing.current}`);

    // --- Condition 1: Wallet is NOT definitively connected ---
    // Let's check for non-connected states instead of strictly 'connected'
    const isDisconnected = walletStatus === 'disconnected' || walletStatus === 'pending' || !currentWalletClient;

    if (isDisconnected) {
      // Only reset if state is not already initial/disconnected error
      if (sdkState.ready || sdkState.isLoading || (sdkState.error && sdkState.error !== "Wallet not connected.")) {
        console.warn(`${logPrefix} Wallet status is '${walletStatus}' or client unavailable. Resetting SDK state.`);
        setSdkState({ ...initialState, error: "Wallet not connected." });
      } else {
        // If already in the disconnected error state, just log it.
        console.log(`${logPrefix} Wallet status is '${walletStatus}'. State already reflects disconnection.`);
      }
      // Ensure the initializing flag is false if we disconnect during init
      isInitializing.current = false;
      return; // Stop further processing
    }

    // --- Condition 2: Already Ready ---
    // If we get here, walletStatus is likely 'connected' or 'success' and client exists
    if (sdkState.ready) {
      console.log(`${logPrefix} SDK already ready. Skipping initialization.`);
      return;
    }

    // --- Condition 3: Initialization Already in Progress ---
    if (isInitializing.current) {
      console.log(`${logPrefix} Initialization already in progress. Skipping.`);
      return;
    }

    // --- Condition 4: Ready to Initialize ---
    // If definitively connected, client available, not ready, and not initializing
    console.info(`${logPrefix} Conditions met (Status: ${walletStatus}, Client: ${!!currentWalletClient}, Not Ready, Not Initializing). Starting SDK initialization process.`);
    isInitializing.current = true; // Set flag **before** async operation
    setSdkState(prev => ({ ...prev, isLoading: true, error: null }));

    const initialize = async () => {
      // Use the client captured at the start of this specific effect run
      const clientForInit = currentWalletClient;
      if (!clientForInit) {
        // Should be caught by Condition 1, but safety check
        throw new Error("Wallet client became unavailable during initialization sequence.");
      }

      try {
        // A: Check network ID (essential)
        console.log(`${logPrefix} Checking network ID...`);
        if (clientForInit.chain?.id !== SWEL_CHAIN_ID) {
          throw new Error(`Incorrect Network: Please connect to Swell Chain (ID ${SWEL_CHAIN_ID}). Connected to ${clientForInit.chain?.id}.`);
        }
        console.log(`${logPrefix} Network check passed (Chain ID: ${clientForInit.chain?.id}).`);

        // B: Get Signer
        console.log(`${logPrefix} Attempting to get signer...`);
        const signer = await walletClientToSigner(clientForInit);
        if (!signer) {
          // walletClientToSigner logs details, throw specific error here
          throw new Error("Failed to create signer from wallet client. Check console logs from walletClientToSigner.");
        }
        console.log(`${logPrefix} Signer obtained successfully: ${await signer.getAddress()}`);

        // C: Initialize CrocEnv
        console.log(`${logPrefix} Initializing CrocEnv('swell')...`);
        const croc = new CrocEnv("swell", signer);
        console.log(`${logPrefix} CrocEnv instance created.`);

        // D: Optional - Verification Step
        try {
          const blockNum = await signer.provider.getBlockNumber();
          console.log(`${logPrefix} Verification: SDK connected to RPC. Block: ${blockNum}`);
        } catch (verifyError) {
          console.warn(`${logPrefix} Verification step failed (RPC might be slow/unstable, but proceeding):`, verifyError);
        }

        // E: Set Ready State
        console.info(`${logPrefix} SDK Initialization successful! Setting ready state.`);
        setSdkState({
          croc: croc,
          signer: signer,
          ready: true,
          error: null,
          isLoading: false
        });

      } catch (error: any) {
        const errorMsg = error?.message || "Unknown error during SDK initialization";
        console.error(`${logPrefix} SDK Initialization failed:`, errorMsg, error);
        setSdkState({
          ...initialState, // Reset croc/signer
          error: errorMsg, // Set specific error
          isLoading: false,
          ready: false
        });
      } finally {
        console.log(`${logPrefix} Initialization attempt finished. Resetting isInitializing flag.`);
        isInitializing.current = false;
      }
    };

    initialize();

    // Dependency Array: React only on wallet status and the client object itself changing.
  }, [walletStatus, walletClient]); // React to changes in these specific values

  return sdkState;
}