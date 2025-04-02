/*****************************
 * FILE: src/components/AmbientInteractionController.tsx
 *****************************/
import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useAmbientSDK } from '../hooks/useAmbientSDK'; // Assuming hook remains the same
import { StatusDisplay } from './StatusDisplay';
import { TokenApproval } from './TokenApproval';
import { SwapInteraction } from './SwapInteraction';
import { AmbientLiquidityInteraction } from './AmbientLiquidityInteraction';
import { ConcentratedLiquidityInteraction } from './ConcentratedLiquidityInteraction';
import {
    AMBIENT_DEX_ADDRESS,
    DEFAULT_TOKEN_BASE_ADDRESS, DEFAULT_TOKEN_QUOTE_ADDRESS,
    DEFAULT_TOKEN_BASE_SYMBOL, DEFAULT_TOKEN_QUOTE_SYMBOL,
    DEFAULT_TOKEN_BASE_DECIMALS, DEFAULT_TOKEN_QUOTE_DECIMALS
} from '../constants';

export function AmbientInteractionController() {
  const { isConnected, address } = useAccount();
  // Use the SDK hook which manages initialization state
  const { croc, signer, ready, error: sdkError, isLoading: isSdkLoading } = useAmbientSDK();
  const sdk = ready && croc && signer ? croc : null; // Pass CrocEnv instance if ready

  const [status, setStatus] = useState("Connect wallet and ensure Swell Chain is selected.");
  const [isLoading, setIsLoading] = useState(false); // General loading state for actions (e.g., approving, swapping)

  // Update status based on SDK initialization progress and connection status
  useEffect(() => {
    if (!isConnected) {
      setStatus("Please connect your wallet.");
    } else if (isSdkLoading) {
      setStatus("Initializing Ambient SDK...");
    } else if (sdkError) {
      // Display specific SDK init error
      setStatus(`SDK Initialization Error: ${sdkError}`);
    } else if (ready && sdk && signer) {
      // Check if signer address matches connected address, might indicate state issue
      signer.getAddress().then(signerAddr => {
          if (signerAddr.toLowerCase() !== address?.toLowerCase()) {
              setStatus("Wallet address mismatch. Please reconnect wallet or refresh.");
          } else {
              // Default ready state message
              setStatus("Ambient SDK ready. Approve tokens below if needed.");
          }
      }).catch(() => {
           setStatus("Error verifying signer address. Please refresh.");
      });
    } else if (!isSdkLoading && isConnected && !sdkError && (!sdk || !signer)){
      // This state can happen if the hook runs before signer is fully available after connection
      // or if walletClientToSigner returned null due to wrong network initially
      setStatus("Waiting for SDK components...");
    } else {
        // Fallback / initial state before checks run
        setStatus("Checking wallet connection and SDK status...")
    }
    // Reset action loading state when SDK status changes
    setIsLoading(false);

  }, [isConnected, isSdkLoading, sdkError, ready, sdk, signer, address]);

  // Define tokens used in this example
  const baseToken = {
      address: DEFAULT_TOKEN_BASE_ADDRESS,
      symbol: DEFAULT_TOKEN_BASE_SYMBOL,
      decimals: DEFAULT_TOKEN_BASE_DECIMALS
  };
  const quoteToken = {
      address: DEFAULT_TOKEN_QUOTE_ADDRESS,
      symbol: DEFAULT_TOKEN_QUOTE_SYMBOL,
      decimals: DEFAULT_TOKEN_QUOTE_DECIMALS
  };

  // Render placeholder if not connected
  if (!isConnected) {
    return <p style={{ textAlign: 'center', marginTop: '20px' }}>Please connect your wallet to interact with Ambient DEX.</p>;
  }

  // Combined loading state for disabling interactions during SDK init or actions
  const isInteractionDisabled = isLoading || isSdkLoading;

  return (
    <div className="ambient-interaction-container">
      <h3>Interact with Ambient DEX on Swell Chain</h3>

      {/* Display current status/error */}
      <StatusDisplay status={status} error={!isSdkLoading ? sdkError : null} />

      {/* Approval Section - Render only if SDK is ready and signer exists */}
      {ready && signer && address && (
        <div className="interaction-section">
          <h4>Token Approvals</h4>
          <p style={{ fontSize: '0.9em', color: '#666', marginTop: '-10px', marginBottom: '15px' }}>
            Approve tokens for use with the Ambient DEX contract ({AMBIENT_DEX_ADDRESS}). ETH does not require approval.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {/* Approval for Base Token (e.g., ETH) */}
            <TokenApproval
              signer={signer}
              userAddress={address}
              tokenAddress={baseToken.address}
              tokenSymbol={baseToken.symbol}
              tokenDecimals={baseToken.decimals}
              setStatus={setStatus} // Pass down setStatus for feedback
              setIsLoading={setIsLoading} // Pass down setIsLoading for disabling buttons
              isLoading={isLoading} // Pass down current loading state
            />
            {/* Approval for Quote Token (e.g., KING) */}
            <TokenApproval
              signer={signer}
              userAddress={address}
              tokenAddress={quoteToken.address}
              tokenSymbol={quoteToken.symbol}
              tokenDecimals={quoteToken.decimals}
              setStatus={setStatus}
              setIsLoading={setIsLoading}
              isLoading={isLoading}
            />
          </div>
        </div>
      )}

      {/* Interaction Sections - Render only if SDK is ready */}
      {ready && sdk && (
        <>
          <SwapInteraction
            sdk={sdk}
            setStatus={setStatus}
            setIsLoading={setIsLoading}
            isLoading={isInteractionDisabled} // Disable during SDK init or other actions
          />

          <AmbientLiquidityInteraction
            sdk={sdk}
            setStatus={setStatus}
            setIsLoading={setIsLoading}
            isLoading={isInteractionDisabled}
          />

          <ConcentratedLiquidityInteraction
            sdk={sdk}
            setStatus={setStatus}
            setIsLoading={setIsLoading}
            isLoading={isInteractionDisabled}
          />
        </>
      )}

       {/* Show specific messages if SDK isn't ready yet */}
        {!ready && isConnected && !isSdkLoading && !sdkError && (
            <p style={{textAlign: 'center', color: '#666', fontStyle: 'italic'}}>Waiting for SDK initialization...</p>
        )}
         {isSdkLoading && (
             <p style={{textAlign: 'center', color: 'orange', fontStyle: 'italic'}}>SDK Initializing...</p>
        )}
         {sdkError && !isSdkLoading &&(
             <p style={{textAlign: 'center', color: 'red', fontWeight: 'bold'}}>SDK Failed to Initialize. Check console & network.</p>
        )}

    </div>
  );
}

