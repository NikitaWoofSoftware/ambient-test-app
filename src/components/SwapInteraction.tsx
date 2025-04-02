/*****************************
 * FILE: src/components/SwapInteraction.tsx
 *****************************/
import React, { useState } from 'react';
import { type CrocEnv } from '@crocswap-libs/sdk';
import {
    ETH_ADDRESS, ETH_SYMBOL, KING_SWELL_ADDRESS, KING_SWELL_SYMBOL,
    DEFAULT_SWAP_AMOUNT, DEFAULT_SLIPPAGE, NATIVE_DECIMALS, KING_SWELL_DECIMALS,
    DEFAULT_TOKEN_BASE_ADDRESS, DEFAULT_TOKEN_QUOTE_ADDRESS // Import defaults
} from '../constants';

interface SwapInteractionProps {
  sdk: CrocEnv | null;
  setStatus: (status: string) => void;
  setIsLoading: (loading: boolean) => void;
  isLoading: boolean;
}

export function SwapInteraction({ sdk, setStatus, setIsLoading, isLoading }: SwapInteractionProps) {
  // Use constants for initial state
  const [tokenInAddr, setTokenInAddr] = useState(DEFAULT_TOKEN_BASE_ADDRESS);
  const [tokenOutAddr, setTokenOutAddr] = useState(DEFAULT_TOKEN_QUOTE_ADDRESS);
  const [amountIn, setAmountIn] = useState(DEFAULT_SWAP_AMOUNT);

  const handleSwap = async () => {
    if (!sdk) {
      setStatus("Error: SDK not initialized");
      return;
    }

    setIsLoading(true);
    setStatus("Processing swap...");

    try {
      const amountInFloat = parseFloat(amountIn);
      if (isNaN(amountInFloat) || amountInFloat <= 0) {
        setStatus("Error: Invalid amount specified");
        setIsLoading(false);
        return;
      }

      // Determine swap type based on tokens
      let tx;
      const slippageOptions = { slippage: DEFAULT_SLIPPAGE };

      const tokenInSymbol = tokenInAddr.toLowerCase() === ETH_ADDRESS.toLowerCase() ? ETH_SYMBOL : KING_SWELL_SYMBOL;
      const tokenOutSymbol = tokenOutAddr.toLowerCase() === ETH_ADDRESS.toLowerCase() ? ETH_SYMBOL : KING_SWELL_SYMBOL;
      setStatus(`Swapping ${amountIn} ${tokenInSymbol} for ${tokenOutSymbol}...`);

      if (tokenInAddr.toLowerCase() === ETH_ADDRESS.toLowerCase()) {
        // Selling ETH for Token
        console.log(`Executing: sdk.sellEth(${amountInFloat}).for(${tokenOutAddr}, ${JSON.stringify(slippageOptions)})`);
        tx = await sdk.sellEth(amountInFloat).for(tokenOutAddr, slippageOptions).swap();
      } else if (tokenOutAddr.toLowerCase() === ETH_ADDRESS.toLowerCase()) {
        // Selling Token for ETH
        console.log(`Executing: sdk.sell(${tokenInAddr}, ${amountInFloat}).forEth(${JSON.stringify(slippageOptions)})`);
        tx = await sdk.sell(tokenInAddr, amountInFloat).forEth(slippageOptions).swap();
      } else {
        // Selling Token for Token (ensure they are different)
        if (tokenInAddr.toLowerCase() === tokenOutAddr.toLowerCase()) {
            throw new Error("Input and output tokens cannot be the same.");
        }
        console.log(`Executing: sdk.sell(${tokenInAddr}, ${amountInFloat}).for(${tokenOutAddr}, ${JSON.stringify(slippageOptions)})`);
        tx = await sdk.sell(tokenInAddr, amountInFloat).for(tokenOutAddr, slippageOptions).swap();
      }

      setStatus(`Swap transaction sent: ${tx.hash}. Waiting for confirmation...`);
      await tx.wait(1); // Wait for 1 confirmation
      setStatus(`Swap successful! Tx: ${tx.hash}`);

    } catch (error: any) {
      console.error("Swap failed:", error);
      // Try to provide a more specific error message if possible
      let message = error.message;
      if (error.shortMessage) message = error.shortMessage; // Use shortMessage if available from ethers
      if (message.includes('user rejected transaction')) message = 'Transaction rejected by wallet.';
      if (message.includes('insufficient funds')) message = 'Insufficient funds for transaction.';
      // Add check for specific SDK errors if needed
      setStatus(`Swap failed: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const switchTokens = () => {
      const tempAddr = tokenInAddr;
      setTokenInAddr(tokenOutAddr);
      setTokenOutAddr(tempAddr);
      // Optionally reset amount or fetch new quote here
      // setAmountIn(DEFAULT_SWAP_AMOUNT);
  }

  // Derive symbols and decimals based on current addresses
   const tokenIn = tokenInAddr.toLowerCase() === ETH_ADDRESS.toLowerCase()
    ? { address: ETH_ADDRESS, symbol: ETH_SYMBOL, decimals: NATIVE_DECIMALS }
    : { address: KING_SWELL_ADDRESS, symbol: KING_SWELL_SYMBOL, decimals: KING_SWELL_DECIMALS };

   const tokenOut = tokenOutAddr.toLowerCase() === ETH_ADDRESS.toLowerCase()
    ? { address: ETH_ADDRESS, symbol: ETH_SYMBOL, decimals: NATIVE_DECIMALS }
    : { address: KING_SWELL_ADDRESS, symbol: KING_SWELL_SYMBOL, decimals: KING_SWELL_DECIMALS };


  return (
    <div className="interaction-section">
      <h4>Swap Tokens</h4>
        <div className="token-pair-display">
            {tokenIn.symbol} <button onClick={switchTokens} disabled={isLoading} style={{padding: '2px 6px', fontSize: '0.8em', margin: '0 10px'}} title="Switch Tokens">⇄</button> {tokenOut.symbol}
        </div>

      <div className="form-group">
        <label htmlFor="amountIn">Amount In ({tokenIn.symbol}):</label>
        <input
          id="amountIn"
          type="number" // Use number type for better input control
          value={amountIn}
          onChange={(e) => setAmountIn(e.target.value)}
          disabled={isLoading}
          step="any" // Allow any decimal input
          min="0"
          placeholder="0.0"
        />
         <small>In Address: {tokenIn.address}</small>
         <small>Out Address: {tokenOut.address}</small>
      </div>

      <button
        onClick={handleSwap}
        disabled={isLoading || !sdk || tokenInAddr.toLowerCase() === tokenOutAddr.toLowerCase()}
      >
        {isLoading ? 'Swapping...' : `Swap ${tokenIn.symbol} for ${tokenOut.symbol}`}
      </button>
    </div>
  );
}

