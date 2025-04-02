/*****************************
 * FILE: src/components/ConcentratedLiquidityInteraction.tsx
 *****************************/
import React, { useState } from 'react';
import { type CrocEnv, CrocPoolView } from '@crocswap-libs/sdk';
import {
    ETH_ADDRESS, // Import ETH address
    DEFAULT_TOKEN_BASE_ADDRESS, DEFAULT_TOKEN_BASE_SYMBOL,
    DEFAULT_TOKEN_QUOTE_ADDRESS, DEFAULT_TOKEN_QUOTE_SYMBOL,
    DEFAULT_LIQUIDITY_AMOUNT, DEFAULT_SLIPPAGE,
    DEFAULT_TICK_SPACING // Import tick spacing
} from '../constants';

interface ConcentratedLiquidityInteractionProps {
  sdk: CrocEnv | null;
  setStatus: (status: string) => void;
  setIsLoading: (loading: boolean) => void;
  isLoading: boolean;
}

export function ConcentratedLiquidityInteraction({ sdk, setStatus, setIsLoading, isLoading }: ConcentratedLiquidityInteractionProps) {

  // Tokens used in this example
  const baseTokenAddr = DEFAULT_TOKEN_BASE_ADDRESS;   // ETH
  const quoteTokenAddr = DEFAULT_TOKEN_QUOTE_ADDRESS; // KING
  const baseTokenSymbol = DEFAULT_TOKEN_BASE_SYMBOL;
  const quoteTokenSymbol = DEFAULT_TOKEN_QUOTE_SYMBOL;
  const amount = DEFAULT_LIQUIDITY_AMOUNT;
  // Assume adding liquidity using the Base Token (ETH)
  const tokenToAddSymbol = baseTokenSymbol;
  const tokenToAddAddr = baseTokenAddr;


  const [lowerPriceInput, setLowerPriceInput] = useState("3000");
  const [upperPriceInput, setUpperPriceInput] = useState("3500");

  // Define tickRange outside try block to be accessible in catch
  let tickRange: [number, number] | null = null;

  const handleAddConcLiq = async () => {
    if (!sdk) {
      setStatus("Error: SDK not initialized");
      return;
    }

    setIsLoading(true);
    const amountFloat = parseFloat(amount);
    setStatus(`Processing Add Concentrated Liquidity (${amount} ${tokenToAddSymbol} for ${baseTokenSymbol}/${quoteTokenSymbol})...`);
    tickRange = null; // Reset tickRange for each attempt

    try {
      // --- Pool Creation ---
      let pool: CrocPoolView;
      console.log(`Creating pool view for ${baseTokenSymbol}/${quoteTokenSymbol}`);

      if (baseTokenAddr.toLowerCase() === ETH_ADDRESS.toLowerCase()) {
          console.log(`Using sdk.poolEth('${quoteTokenAddr}')`);
          pool = sdk.poolEth(quoteTokenAddr);
      } else {
          console.log(`Using generic sdk.pool('${quoteTokenAddr}', '${baseTokenAddr}')`);
          pool = sdk.pool(quoteTokenAddr, baseTokenAddr);
      }

      console.log(`Pool view obtained. Base: ${pool.baseToken.tokenAddr}, Quote: ${pool.quoteToken.tokenAddr}`);
      console.log(`Actual Base Symbol: ${pool.baseToken.symbol}, Actual Quote Symbol: ${pool.quoteToken.symbol}`);

      const isAddingBase = tokenToAddAddr.toLowerCase() === pool.baseToken.tokenAddr.toLowerCase();
      console.log(`Attempting to add ${amountFloat} of ${tokenToAddSymbol}. Pool confirms adding base token? ${isAddingBase}`);

      // --- Tick Range Logic ---
      const currentTick = await pool.spotTick();
      console.log(`Current pool tick: ${currentTick}`);

      const lowerTickCalc = Math.floor(currentTick / DEFAULT_TICK_SPACING) * DEFAULT_TICK_SPACING;
      const upperTickCalc = lowerTickCalc + DEFAULT_TICK_SPACING;

      // Ensure standard integer numbers for the tick range
      tickRange = [
          parseInt(lowerTickCalc.toString(), 10),
          parseInt(upperTickCalc.toString(), 10)
      ];
      console.log(`Using calculated tick range (standard integers): [${tickRange[0]}, ${tickRange[1]}]`);

      // --- Explicit Price Limit Calculation ---
      // This mirrors the likely successful approach from the original code
      const currentSpotPrice = await pool.spotPrice();
      console.log(`Current spot price: ${currentSpotPrice}`);

      const lowerPriceLimit = currentSpotPrice * (1 - DEFAULT_SLIPPAGE);
      const upperPriceLimit = currentSpotPrice * (1 + DEFAULT_SLIPPAGE);
      const priceLimitRange: [number, number] = [lowerPriceLimit, upperPriceLimit];
      console.log(`Calculated price limits for slippage: [${priceLimitRange[0].toFixed(6)}, ${priceLimitRange[1].toFixed(6)}]`);


      console.log(`Using ${tokenToAddSymbol} (${tokenToAddAddr}) to add concentrated liquidity.`);
      console.log(`Amount: ${amountFloat}`);
      // Log the range being used
      console.log(`Using calculated tick range: [${tickRange[0]}, ${tickRange[1]}]`);
      console.log(`Ignoring user price inputs (${lowerPriceInput}, ${upperPriceInput}) for this simplified example.`);

      // --- Transaction ---
      // Pass explicit price limits as 3rd argument, options (without slippage) as 4th
      const txOptions = { surplus: false }; // Remove slippage from options
      setStatus(`Adding ${amountFloat} ${tokenToAddSymbol} in range [${tickRange[0]}, ${tickRange[1]}] with price limits...`);

      let tx;
      if (isAddingBase) {
        console.log(`Executing: pool.mintRangeBase(${amountFloat}, [${tickRange[0]}, ${tickRange[1]}], [${priceLimitRange[0]}, ${priceLimitRange[1]}], ${JSON.stringify(txOptions)})`);
        // *** PASSING EXPLICIT PRICE LIMITS (3rd arg) ***
        tx = await pool.mintRangeBase(amountFloat, tickRange, priceLimitRange, txOptions);
      } else {
        console.log(`Executing: pool.mintRangeQuote(${amountFloat}, [${tickRange[0]}, ${tickRange[1]}], [${priceLimitRange[0]}, ${priceLimitRange[1]}], ${JSON.stringify(txOptions)})`);
        // *** PASSING EXPLICIT PRICE LIMITS (3rd arg) ***
        tx = await pool.mintRangeQuote(amountFloat, tickRange, priceLimitRange, txOptions);
      }

      setStatus(`Add Concentrated Liquidity Tx sent: ${tx.hash}. Waiting...`);
      await tx.wait(1);
      setStatus(`Add Concentrated Liquidity successful! Tx: ${tx.hash}`);

    } catch (error: any) {
      const tickRangeStr = tickRange ? `[${tickRange?.[0]}, ${tickRange?.[1]}]` : "[Error getting range]";
      console.error(`Add Concentrated Liquidity failed with tickRange: ${tickRangeStr}`, error);

      let message = error.message;
      // Add check for the original RangeError, just in case
      if (error instanceof RangeError && message.includes("Not an integer")) {
          message = `RangeError: Not an integer. Input ticks were ${tickRangeStr}. (${message})`;
      } else if (error.shortMessage) {
          message = error.shortMessage;
      }

      // Keep existing error message parsing
      if (message.includes('user rejected transaction')) message = 'Transaction rejected by wallet.';
      if (message.includes('insufficient funds')) message = 'Insufficient funds for transaction.';
      if (message.includes("reverted: 'D'")) message = "Reverted with 'D' error (price check failed, likely movement). Try again.";
      if (message.includes("reverted: 'RC'")) message = "Reverted with 'RC' error (slippage check failed). Try again.";
      if (message.includes("reverted: 'TL'") || message.includes("reverted: 'TU'")) message = "Reverted with 'TL'/'TU' error (tick bounds). Range might be invalid.";
      if (message.includes("reverted: ")) {
           const revertMatch = message.match(/reverted(?: with reason string)? ['\"]?(.+?)['\"]?$/);
           message = revertMatch ? `Transaction reverted: ${revertMatch[1]}` : "Transaction reverted by contract.";
      }
      setStatus(`Add Concentrated Liquidity failed: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ... (return statement remains the same)
  return (
    <div className="interaction-section">
      <h4>Add Concentrated Liquidity</h4>
      <div className="token-pair-display">
          Using Pair: {baseTokenSymbol} / {quoteTokenSymbol}
      </div>
      {/* Keep inputs for show, but explain they are ignored */}
       <div className="form-group">
          <label htmlFor="lowerPrice">Lower Price (Informational Only):</label>
          <input
            id="lowerPrice"
            type="number"
            value={lowerPriceInput}
            onChange={(e) => setLowerPriceInput(e.target.value)}
            disabled={isLoading}
            placeholder="e.g., 3000"
          />
        </div>
        <div className="form-group">
          <label htmlFor="upperPrice">Upper Price (Informational Only):</label>
          <input
            id="upperPrice"
            type="number"
            value={upperPriceInput}
            onChange={(e) => setUpperPriceInput(e.target.value)}
            disabled={isLoading}
            placeholder="e.g., 3500"
          />
        </div>

      <button
        onClick={handleAddConcLiq}
        disabled={isLoading || !sdk}
      >
        {isLoading ? 'Adding...' : `Add ${amount} ${tokenToAddSymbol} (Concentrated)`}
      </button>

      <div className="info-box">
        <strong>Example Simplification:</strong> This action adds a fixed amount ({amount} {tokenToAddSymbol}) using a narrow tick range calculated <strong>around the current market price</strong>, aligned to tick spacing {DEFAULT_TICK_SPACING}. It now also calculates explicit price limits based on slippage.
        <br />
        <strong>The price inputs above are currently ignored for this demo.</strong> Ensure you have approved {tokenToAddSymbol} if it's not the native token (ETH).
      </div>
    </div>
  );
}