/*****************************
 * FILE: src/components/AmbientLiquidityInteraction.tsx
 *****************************/
import React from 'react';
import { type CrocEnv, CrocPoolView } from '@crocswap-libs/sdk';
import {
    ETH_ADDRESS, // Import ETH address
    DEFAULT_TOKEN_BASE_ADDRESS, DEFAULT_TOKEN_BASE_SYMBOL,
    DEFAULT_TOKEN_QUOTE_ADDRESS, DEFAULT_TOKEN_QUOTE_SYMBOL,
    DEFAULT_LIQUIDITY_AMOUNT // Using the smaller default amount
} from '../constants';

interface AmbientLiquidityInteractionProps {
  sdk: CrocEnv | null;
  setStatus: (status: string) => void;
  setIsLoading: (loading: boolean) => void;
  isLoading: boolean;
}

export function AmbientLiquidityInteraction({ sdk, setStatus, setIsLoading, isLoading }: AmbientLiquidityInteractionProps) {

  // For this example, we use fixed tokens and a fixed amount for simplicity
  const tokenA = DEFAULT_TOKEN_BASE_ADDRESS; // e.g., ETH
  const tokenB = DEFAULT_TOKEN_QUOTE_ADDRESS; // e.g., KING
  const tokenASymbol = DEFAULT_TOKEN_BASE_SYMBOL;
  const tokenBSymbol = DEFAULT_TOKEN_QUOTE_SYMBOL;
  const amount = DEFAULT_LIQUIDITY_AMOUNT; // Fixed amount for the example
  // We'll assume adding liquidity using Token A (Base Token / ETH in this example)
  const tokenToAddSymbol = tokenASymbol;

  const handleAddAmbientLiq = async () => {
    if (!sdk) {
      setStatus("Error: SDK not initialized");
      return;
    }

    setIsLoading(true);
    const amountFloat = parseFloat(amount);
    setStatus(`Processing Add Ambient Liquidity (${amount} ${tokenToAddSymbol} for ${tokenASymbol}/${tokenBSymbol})...`);

    try {
       // Get pool view (SDK determines base/quote automatically)
       let pool: CrocPoolView;
       console.log(`Creating pool view for ${tokenASymbol}/${tokenBSymbol}`);
       pool = sdk.pool(tokenB, tokenA); // CrocEnv heuristic: pool(Quote, Base)
       // If using ETH specifically:
       // if (tokenA.toLowerCase() === ETH_ADDRESS.toLowerCase()) {
       //     pool = sdk.poolEth(tokenB); // Assuming tokenB is Quote
       // } else if (tokenB.toLowerCase() === ETH_ADDRESS.toLowerCase()) {
       //     pool = sdk.poolEth(tokenA); // Assuming tokenA is Quote
       // } else {
       //     pool = sdk.pool(tokenB, tokenA); // Fallback heuristic
       // }


      console.log(`Pool view obtained. Base: ${pool.baseToken.tokenAddr}, Quote: ${pool.quoteToken.tokenAddr}`);
      console.log(`Actual Base Symbol: ${pool.baseToken.symbol}, Actual Quote Symbol: ${pool.quoteToken.symbol}`);

      // Determine which token we are actually adding based on the pool's perspective
      const isAddingBase = tokenA.toLowerCase() === pool.baseToken.tokenAddr.toLowerCase();
      console.log(`Attempting to add ${amountFloat} of ${tokenToAddSymbol}. Is this the base token? ${isAddingBase}`);

      // For Ambient, use extremely wide price range to ensure minting.
      // The SDK might handle this internally, but specifying can be safer.
      // Using min/max ticks provides the widest possible range.
      const minTick = -887272;
      const maxTick = 887272;
      const lowerPrice = Math.pow(1.0001, minTick);
      const upperPrice = Math.pow(1.0001, maxTick);
      const widePriceRange: [number, number] = [lowerPrice, upperPrice];

      setStatus(`Adding ${amountFloat} ${tokenToAddSymbol} as ambient liquidity...`);

      let tx;
      if (isAddingBase) {
        // Add liquidity using the base token
        console.log(`Executing: pool.mintAmbientBase(${amountFloat}, [${lowerPrice}, ${upperPrice}], { surplus: false })`);
        tx = await pool.mintAmbientBase(amountFloat, widePriceRange, { surplus: false });
      } else {
        // Add liquidity using the quote token
        console.log(`Executing: pool.mintAmbientQuote(${amountFloat}, [${lowerPrice}, ${upperPrice}], { surplus: false })`);
        tx = await pool.mintAmbientQuote(amountFloat, widePriceRange, { surplus: false });
      }

      setStatus(`Add Ambient Liquidity Tx sent: ${tx.hash}. Waiting...`);
      await tx.wait(1);
      setStatus(`Add Ambient Liquidity successful! Tx: ${tx.hash}`);

    } catch (error: any) {
      console.error("Add Ambient Liquidity failed:", error);
      let message = error.message;
      if (error.shortMessage) message = error.shortMessage;
      if (message.includes('user rejected transaction')) message = 'Transaction rejected by wallet.';
      if (message.includes('insufficient funds')) message = 'Insufficient funds for transaction.';
      setStatus(`Add Ambient Liquidity failed: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="interaction-section">
      <h4>Add Ambient Liquidity</h4>
      <div className="token-pair-display">
          Using Pair: {tokenASymbol} / {tokenBSymbol}
      </div>
      <button
        onClick={handleAddAmbientLiq}
        disabled={isLoading || !sdk}
      >
        {isLoading ? 'Adding...' : `Add ${amount} ${tokenToAddSymbol} (Ambient)`}
      </button>
      <div className="info-box">
        <strong>Note:</strong> This action adds a fixed amount ({amount} {tokenToAddSymbol}) of ambient (full range) liquidity for the {tokenASymbol}/{tokenBSymbol} pair. Ensure you have approved {tokenToAddSymbol} if it's not the native token (ETH).
      </div>
    </div>
  );
}
