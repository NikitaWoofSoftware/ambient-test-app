import React, { useState, useEffect } from 'react';
import { formatUnits, parseUnits, ZeroAddress, Contract, MaxUint256, AbiCoder } from 'ethers';
import { useAccount } from 'wagmi';
import { useAmbientSDK } from '../hooks/useAmbientSDK';

// Real token addresses on Swell Chain - Use ETH instead of WETH for native token
const ETH_ADDRESS = ZeroAddress; // 0x0000000000000000000000000000000000000000 for native ETH
const KING_SWELL = "0xc2606aade4bdd978a4fa5a6edb3b66657acee6f8"; // KING on Swell Chain

// Ambient contract addresses on Swell
const DEX_ADDRESS = "0xaAAaAaaa82812F0a1f274016514ba2cA933bF24D";

export function AmbientInteraction() {
  const { isConnected, address } = useAccount();
  // Используем обновлённый хук, который сам управляет инициализацией
  const { croc, signer, ready, error, isLoading: isSdkLoading } = useAmbientSDK();
  
  // SDK теперь объект с croc и signer
  const sdk = ready && croc && signer ? { croc, signer } : null;
  
  const [tokenIn, setTokenIn] = useState(ETH_ADDRESS);
  const [tokenOut, setTokenOut] = useState(KING_SWELL);
  const [amountIn, setAmountIn] = useState("0.01");
  const [lowerPrice, setLowerPrice] = useState("3000");
  const [upperPrice, setUpperPrice] = useState("3500");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Обновляем статус при изменении состояния SDK
  useEffect(() => {
    if (error) {
      setStatus(`Error: ${error}`);
    } else if (ready && sdk) {
      setStatus("SDK initialized and ready");
    } else if (isSdkLoading) {
      setStatus("Initializing SDK...");
    }
  }, [ready, error, isSdkLoading, sdk]);

  // Helper for token approvals
  async function approveToken(tokenAddress: string, amount: string, decimals: number = 18) {
    // Проверка на нативный ETH, он не требует approve
    if (tokenAddress.toLowerCase() === ETH_ADDRESS.toLowerCase()) {
      setStatus("Native ETH does not require approval");
      return true;
    }
    
    // Проверка sdk и address
    if (!sdk?.signer || !address) {
      setStatus("Signer not available in SDK");
      console.error("Signer not available in SDK", sdk);
      return false;
    }

    // Получаем signer напрямую из sdk
    const signer = sdk.signer;

    try {
      console.log(`Checking approval for token ${tokenAddress}...`);

      const erc20Interface = [
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)"
      ];

      // Создаем экземпляр контракта СРАЗУ с signer'ом
      const contract = new Contract(tokenAddress, erc20Interface, signer);

      // Проверяем текущий allowance
      const currentAllowance = await contract.allowance(address, DEX_ADDRESS);
      
      // Обработка MaxUint256 для максимального одобрения
      const amountBigInt = amount === MaxUint256.toString() 
                          ? MaxUint256 
                          : parseUnits(amount, decimals);

      console.log(`Current allowance: ${currentAllowance.toString()}`);
      console.log(`Required amount: ${amountBigInt.toString()}`);
      
      // Запрашиваем только необходимое количество токенов для операции, плюс небольшой запас
      // Для теста нам нужно совсем немного - 0.001 (плюс запас, итого 0.005)
      const smallTestAmount = parseUnits("0.005", decimals); // Маленькая сумма для тестирования
      
      if (currentAllowance >= smallTestAmount) {
        setStatus(`Token ${tokenAddress} already approved for sufficient amount (${formatUnits(currentAllowance, decimals)})`);
        return true;
      } else {
        // Для тестирования лучше не запрашивать MaxUint256, а только небольшое количество
        const approvalAmount = smallTestAmount;
        
        setStatus(`Approving ${tokenAddress} for ${formatUnits(approvalAmount, decimals)}...`);
        
        // Вызываем approve НАПРЯМУЮ (не нужен .connect(signer))
        const tx = await contract.approve(DEX_ADDRESS, approvalAmount);
        setStatus(`Approval transaction sent: ${tx.hash}. Waiting for confirmation...`);
        await tx.wait(); // Дожидаемся подтверждения
        
        setStatus(`Approval successful for ${formatUnits(approvalAmount, decimals)} tokens`);
        return true;
      }
    } catch (error: any) {
      console.error("Approval failed:", error);
      // Попытка извлечь более конкретную ошибку
      const reason = error?.revert?.args?.[0] ?? error.message;
      setStatus(`Approval failed: ${reason}`);
      return false;
    }
  }

  // Perform a swap
  async function handleSwap() {
    if (!sdk || !isConnected) {
      setStatus("SDK not ready or wallet not connected");
      return;
    }
    
    setIsLoading(true);
    setStatus("Processing swap...");
    
    try {
      // Step 1: Approve token (if needed)
      // Для ETH нет необходимости в approve
      if (tokenIn.toLowerCase() !== ETH_ADDRESS.toLowerCase()) {
        const decimalsIn = 18; // KING имеет 18 децималов
        const approved = await approveToken(tokenIn, amountIn, decimalsIn);
        if (!approved) return;
      } else {
        setStatus("Using native ETH, no approval needed");
      }
      
      // Step 2: Выполняем своп
      // CrocEnv.sell(tokenAddress, amount) - продаем указанный токен
      // CrocEnv.sellEth(amount) - продаем нативный ETH
      // CrocEnv.buy(tokenAddress, amount) - покупаем указанный токен
      // CrocEnv.buyEth(amount) - покупаем нативный ETH
      
      let tx;
      const amountInFloat = parseFloat(amountIn);
      const slippage = 0.01; // 1%
      
      if (tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase()) {
        // Продаем ETH, получаем KING
        setStatus("Selling ETH for KING...");
        tx = await sdk.croc.sellEth(amountInFloat).for(tokenOut, { slippage }).swap();
      } else if (tokenOut.toLowerCase() === ETH_ADDRESS.toLowerCase()) {
        // Продаем KING, получаем ETH
        setStatus("Selling KING for ETH...");
        tx = await sdk.croc.sell(tokenIn, amountInFloat).forEth({ slippage }).swap();
      } else {
        // Продаем один токен за другой (оба не ETH)
        setStatus(`Selling ${tokenIn} for ${tokenOut}...`);
        tx = await sdk.croc.sell(tokenIn, amountInFloat).for(tokenOut, { slippage }).swap();
      }
      
      setStatus(`Swap transaction sent: ${tx.hash}. Waiting for confirmation...`);
      await tx.wait();
      setStatus(`Swap successful! Tx: ${tx.hash}`);
    } catch (error: any) {
      console.error("Swap failed:", error);
      setStatus(`Swap failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  // Add ambient liquidity
  async function handleAddAmbientLiq() {
    if (!sdk || !isConnected) {
      setStatus("SDK not ready or wallet not connected");
      return;
    }
    
    setIsLoading(true);
    setStatus("Processing Add Ambient Liquidity (0.001)...");
    
    try {
      // Используем малую сумму для тестирования - 0.001
      const testAmount = "0.001";
      const amountInFloat = 0.001;
      const slippage = 0.01; // 1% слиппаж
      
      // Step 1: Approve tokens (if не ETH)
      if (tokenIn.toLowerCase() !== ETH_ADDRESS.toLowerCase()) {
        const decimalsIn = 18; // KING имеет 18 децималов
        const approved = await approveToken(tokenIn, testAmount, decimalsIn);
        if (!approved) return;
      }
      
      // Approve tokenOut if not ETH
      if (tokenOut.toLowerCase() !== ETH_ADDRESS.toLowerCase()) {
        const decimalsOut = 18; // KING имеет 18 децималов
        const approved = await approveToken(tokenOut, testAmount, decimalsOut);
        if (!approved) return;
      }
      
      // Определим какой токен base, какой quote
      let pool;
      console.log("Getting pool view...");
      
      // Методы создания пула в SDK:
      // croc.pool(tokenQuote, tokenBase) - создает пул с указанным quote и base
      // croc.poolEth(token) - создает пул ETH/token с token как quote
      // croc.poolEthQuote(token) - создает пул token/ETH с ETH как quote
      try {
        if (tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase()) {
          // ETH/tokenOut - ETH как base, tokenOut как quote
          pool = sdk.croc.poolEth(tokenOut);
          console.log("Created ETH/token pool with ETH as base");
        } else if (tokenOut.toLowerCase() === ETH_ADDRESS.toLowerCase()) {
          // tokenIn/ETH - ETH как base, tokenIn как quote
          pool = sdk.croc.poolEth(tokenIn);
          console.log("Created token/ETH pool with ETH as base");
        } else {
          // tokenIn/tokenOut
          // SDK автоматически определит base/quote по адресам
          pool = sdk.croc.pool(tokenIn, tokenOut);
          console.log("Created token/token pool, SDK determined base/quote");
        }
        
        // Выводим информацию о пуле
        console.log("Pool created:", pool);
        console.log("Base token:", pool.baseToken.tokenAddr);
        console.log("Quote token:", pool.quoteToken.tokenAddr);
        
        // Определяем, какой токен мы используем для добавления ликвидности
        const usingBaseToken = tokenIn.toLowerCase() === pool.baseToken.tokenAddr.toLowerCase();
        console.log("Using base token:", usingBaseToken);
        
        // Установить широкие пределы цен для гарантированного выполнения
        const currentSpotPrice = await pool.spotPrice();
        console.log("Current spot price:", currentSpotPrice);
        
        // Для ambient liquidity используем широкий ценовой диапазон
        // Используем ±50% от текущей цены
        const lowerLimit = currentSpotPrice * 0.5;
        const upperLimit = currentSpotPrice * 1.5;
        console.log("Price limits:", [lowerLimit, upperLimit]);
        
        setStatus(`Adding ${testAmount} ${usingBaseToken ? 'base' : 'quote'} token as ambient liquidity...`);
        
        // Get transaction details before sending
        let txDetails;
        try {
          // Use pool.mintAmbient* methods to get transaction details
          if (usingBaseToken) {
            const method = 'mintAmbientBase';
            console.log(`Preparing transaction: ${method}(${amountInFloat}, [${lowerLimit}, ${upperLimit}], { surplus: false })`);
            txDetails = await pool.mintAmbientBase.populateTransaction(amountInFloat, [lowerLimit, upperLimit], { surplus: false });
          } else {
            const method = 'mintAmbientQuote';
            console.log(`Preparing transaction: ${method}(${amountInFloat}, [${lowerLimit}, ${upperLimit}], { surplus: false })`);
            txDetails = await pool.mintAmbientQuote.populateTransaction(amountInFloat, [lowerLimit, upperLimit], { surplus: false });
          }
          
          // Log transaction details for debugging
          console.log("=== TRANSACTION DETAILS FOR AMBIENT LIQUIDITY ===");
          console.log("From:", address);
          console.log("To:", txDetails.to);
          console.log("Value:", txDetails.value?.toString() || "0");
          console.log("Data:", txDetails.data);
          console.log("=== END TRANSACTION DETAILS ===");
          
        } catch (populateError) {
          console.error("Error populating transaction:", populateError);
          setStatus(`Error preparing transaction: ${populateError.message}`);
        }
        
        // Вызов соответствующего метода добавления ликвидности
        let tx;
        if (usingBaseToken) {
          // Добавляем ликвидность, используя base token
          tx = await pool.mintAmbientBase(amountInFloat, [lowerLimit, upperLimit], { surplus: false });
        } else {
          // Добавляем ликвидность, используя quote token
          tx = await pool.mintAmbientQuote(amountInFloat, [lowerLimit, upperLimit], { surplus: false });
        }
        
        setStatus(`Add Ambient Liq Tx sent: ${tx.hash}. Waiting...`);
        console.log("Transaction hash:", tx.hash);
        
        await tx.wait();
        setStatus(`Add Ambient Liq successful! Tx: ${tx.hash}`);
        
      } catch (poolError) {
        console.error("Error working with pool:", poolError);
        setStatus(`Error: ${poolError.message}`);
        throw poolError;
      }
      
    } catch (error: any) {
      console.error("Add Ambient Liq failed:", error);
      let errorMessage = error.message;
      
      // Look for specific error patterns
      if (errorMessage.includes("user rejected transaction")) {
        errorMessage = "Transaction was rejected by the wallet";
      } else if (errorMessage.includes("insufficient funds")) {
        errorMessage = "Insufficient funds for transaction";
      } else if (errorMessage.includes("execution reverted")) {
        // Extract the revert reason if available
        const revertMatch = errorMessage.match(/reverted: (.+?)(?:,|$)/);
        errorMessage = revertMatch ? 
          `Transaction reverted: ${revertMatch[1]}` : 
          "Transaction reverted by the contract";
      }
      
      setStatus(`Add Ambient Liq failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }

  // Add concentrated liquidity
  async function handleAddConcLiq() {
    if (!sdk || !isConnected) {
      setStatus("SDK not ready or wallet not connected");
      return;
    }
    
    setIsLoading(true);
    setStatus("Processing Add Concentrated Liquidity (0.001)...");
    
    try {
      // Используем малую сумму для тестирования - 0.001
      const testAmount = "0.001";
      const amountInFloat = 0.001;
      
      // Step 1: Approve tokens (if не ETH)
      if (tokenIn.toLowerCase() !== ETH_ADDRESS.toLowerCase()) {
        const decimalsIn = 18; // KING имеет 18 децималов
        const approved = await approveToken(tokenIn, testAmount, decimalsIn);
        if (!approved) return;
      }
      
      // Approve tokenOut if not ETH
      if (tokenOut.toLowerCase() !== ETH_ADDRESS.toLowerCase()) {
        const decimalsOut = 18; // KING имеет 18 децималов
        const approved = await approveToken(tokenOut, testAmount, decimalsOut);
        if (!approved) return;
      }
      
      // Calculate price range from UI inputs
      const lowerPriceVal = parseFloat(lowerPrice);
      const upperPriceVal = parseFloat(upperPrice);
      
      if (isNaN(lowerPriceVal) || isNaN(upperPriceVal)) {
        setStatus("Error: Please enter valid numeric values for price range");
        setIsLoading(false);
        return;
      }
      
      // Ensure lower is always less than upper
      const sortedPriceRange = [Math.min(lowerPriceVal, upperPriceVal), Math.max(lowerPriceVal, upperPriceVal)];
      
      // Определим какой токен base, какой quote
      let pool;
      console.log("Getting pool view...");
      
      try {
        if (tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase()) {
          // ETH/tokenOut - ETH как base, tokenOut как quote
          pool = sdk.croc.poolEth(tokenOut);
          console.log("Created ETH/token pool with ETH as base");
        } else if (tokenOut.toLowerCase() === ETH_ADDRESS.toLowerCase()) {
          // tokenIn/ETH - ETH как base, tokenIn как quote
          pool = sdk.croc.poolEth(tokenIn);
          console.log("Created token/ETH pool with ETH as base");
        } else {
          // tokenIn/tokenOut
          // SDK автоматически определит base/quote по адресам
          pool = sdk.croc.pool(tokenIn, tokenOut);
          console.log("Created token/token pool, SDK determined base/quote");
        }
        
        // Выводим информацию о пуле
        console.log("Pool created:");
        console.log("Base token:", pool.baseToken.tokenAddr);
        console.log("Quote token:", pool.quoteToken.tokenAddr);
        
        // Определяем, какой токен мы используем для добавления ликвидности
        const usingBaseToken = tokenIn.toLowerCase() === pool.baseToken.tokenAddr.toLowerCase();
        console.log("Using base token:", usingBaseToken);
        
        // Get current display price and spot price
        const currentDisplayPrice = await pool.displayPrice();
        console.log("Current display price:", currentDisplayPrice);
        
        const currentSpotPrice = await pool.spotPrice();
        console.log("Current spot price:", currentSpotPrice);
        
        // Get current tick for reference
        const currentTick = await pool.spotTick();
        console.log("Current tick:", currentTick);
        
        setStatus(`Current price: ${currentDisplayPrice.toFixed(2)}, getting valid tick range...`);
        
        // First try: Use SDK's displayToNeighborTicks for proper tick spacing
        let validTickRange;
        try {
          // Get neighboring ticks that respect the protocol's tick spacing
          const neighborTicks = await pool.displayToNeighborTicks(currentDisplayPrice);
          console.log("Neighbor ticks from SDK:", neighborTicks);
          
          // Find ticks that are closest to our desired price range
          // Convert user price range to ticks for comparison
          const userLowerTick = Math.floor(Math.log(Math.sqrt(lowerPriceVal)) / Math.log(1.0001));
          const userUpperTick = Math.ceil(Math.log(Math.sqrt(upperPriceVal)) / Math.log(1.0001));
          
          // Find the closest valid lower and upper ticks to user's range
          let lowerValidTick = null;
          let upperValidTick = null;
          
          // Sort ticks in ascending order
          const sortedTicks = [...neighborTicks].sort((a, b) => a - b);
          
          // Find lower tick (closest valid tick below or equal to userLowerTick)
          for (const tick of sortedTicks) {
            if (tick <= userLowerTick) {
              lowerValidTick = tick;
            } else {
              break;
            }
          }
          
          // If no valid tick found below userLowerTick, use the lowest available
          if (lowerValidTick === null && sortedTicks.length > 0) {
            lowerValidTick = sortedTicks[0];
          }
          
          // Find upper tick (closest valid tick above or equal to userUpperTick)
          for (const tick of [...sortedTicks].reverse()) {
            if (tick >= userUpperTick) {
              upperValidTick = tick;
            } else {
              break;
            }
          }
          
          // If no valid tick found above userUpperTick, use the highest available
          if (upperValidTick === null && sortedTicks.length > 0) {
            upperValidTick = sortedTicks[sortedTicks.length - 1];
          }
          
          // Ensure we have valid ticks and proper order
          if (lowerValidTick !== null && upperValidTick !== null && lowerValidTick < upperValidTick) {
            validTickRange = [lowerValidTick, upperValidTick];
            console.log("Found valid tick range based on user price range:", validTickRange);
            
            // Convert these ticks back to prices for display
            const lowerTickPrice = Math.pow(1.0001, lowerValidTick);
            const upperTickPrice = Math.pow(1.0001, upperValidTick);
            console.log("Price range from valid ticks:", [
              lowerTickPrice * lowerTickPrice, 
              upperTickPrice * upperTickPrice
            ]);
          } else {
            console.log("Could not find valid tick range from neighbor ticks");
          }
        } catch (error) {
          console.error("Error getting neighbor ticks:", error);
        }
        
        // Second try: Try tick ranges based on spot tick if first method fails
        if (!validTickRange) {
          // If we couldn't get a valid range from displayToNeighborTicks,
          // try these fallback ranges in order of preference
          
          // Try to find tick spacing by examining the neighbor ticks we received
          let tickSpacing = 10; // Default to 10 as a common value
          try {
            const nearTicks = await pool.displayToNeighborTicks(currentDisplayPrice, 5);
            if (nearTicks.length >= 2) {
              // Calculate the minimum difference between consecutive ticks
              const sortedTicks = [...nearTicks].sort((a, b) => a - b);
              for (let i = 1; i < sortedTicks.length; i++) {
                const spacing = sortedTicks[i] - sortedTicks[i-1];
                if (spacing > 0 && (tickSpacing === 10 || spacing < tickSpacing)) {
                  tickSpacing = spacing;
                }
              }
              console.log("Detected tick spacing:", tickSpacing);
            }
          } catch (e) {
            console.error("Error detecting tick spacing:", e);
          }
          
          // Generate aligned tick ranges
          const alignedTickRange = [
            Math.floor(currentTick / tickSpacing) * tickSpacing - tickSpacing,
            Math.ceil(currentTick / tickSpacing) * tickSpacing + tickSpacing
          ];
          console.log("Aligned tick range with spacing", tickSpacing, ":", alignedTickRange);
          
          // Super narrow range
          const narrowTickRange = [
            Math.floor(currentTick / tickSpacing) * tickSpacing,
            Math.ceil(currentTick / tickSpacing) * tickSpacing
          ];
          if (narrowTickRange[0] === narrowTickRange[1]) {
            // If they're the same tick, offset the upper one
            narrowTickRange[1] += tickSpacing;
          }
          console.log("Narrow aligned tick range:", narrowTickRange);
          
          // Try these ranges in order
          validTickRange = narrowTickRange;
        }
        
        // If we still don't have a valid range, try the super tight approach as last resort
        if (!validTickRange) {
          validTickRange = [currentTick - 1, currentTick + 1];
          console.log("Using super tight range as last resort:", validTickRange);
        }
        
        // Set price limits for slippage protection
        // Using current spot price ±15% should be safe for execution
        const priceLimits = [currentSpotPrice * 0.85, currentSpotPrice * 1.15];
        console.log("Using price limits for slippage protection:", priceLimits);
        
        // Display feedback to user about tick range translation
        setStatus(`Adding liquidity in range [${lowerPriceVal}-${upperPriceVal}] using valid tick range [${validTickRange[0]}, ${validTickRange[1]}]...`);
        
        // Execute the transaction
        let tx;
        
        try {
          console.log("Executing concentrated liquidity transaction...");
          
          if (usingBaseToken) {
            // Добавляем ликвидность, используя base token (e.g., ETH)
            tx = await pool.mintRangeBase(
              amountInFloat, 
              validTickRange, 
              priceLimits, 
              { surplus: false }
            );
          } else {
            // Добавляем ликвидность, используя quote token (e.g., KING)
            tx = await pool.mintRangeQuote(
              amountInFloat, 
              validTickRange, 
              priceLimits, 
              { surplus: false }
            );
          }
          
          setStatus(`Add Conc Liq Tx sent: ${tx.hash}. Waiting...`);
          console.log("Transaction hash:", tx.hash);
          
          await tx.wait();
          setStatus(`Add Conc Liq successful! Tx: ${tx.hash}`);
          
        } catch (txError) {
          console.error("Transaction failed:", txError);
          
          // If it's a "D" error, try again with an even narrower range
          if (txError.message.includes("reverted: 'D'")) {
            console.log("Received 'D' error, trying with minimum possible range...");
            
            // Try with a single-spacing range right at current tick
            const lastResortRange = [
              Math.floor(currentTick / tickSpacing) * tickSpacing,
              Math.floor(currentTick / tickSpacing) * tickSpacing + tickSpacing
            ];
            console.log("Last resort tick range:", lastResortRange);
            
            setStatus("First attempt failed. Trying with minimum possible range...");
            
            if (usingBaseToken) {
              tx = await pool.mintRangeBase(
                amountInFloat, 
                lastResortRange, 
                priceLimits, 
                { surplus: false }
              );
            } else {
              tx = await pool.mintRangeQuote(
                amountInFloat, 
                lastResortRange, 
                priceLimits, 
                { surplus: false }
              );
            }
            
            setStatus(`Second attempt succeeded! Tx: ${tx.hash}. Waiting...`);
            await tx.wait();
            setStatus(`Add Conc Liq successful with minimum range! Tx: ${tx.hash}`);
            
          } else {
            // Re-throw other errors
            throw txError;
          }
        }
        
      } catch (poolError) {
        console.error("Error working with pool:", poolError);
        setStatus(`Error: ${poolError.message}`);
        throw poolError;
      }
      
    } catch (error: any) {
      console.error("Add Conc Liq failed:", error);
      let errorMessage = error.message;
      
      // Look for specific error patterns
      if (errorMessage.includes("user rejected transaction")) {
        errorMessage = "Transaction was rejected by the wallet";
      } else if (errorMessage.includes("insufficient funds")) {
        errorMessage = "Insufficient funds for transaction";
      } else if (errorMessage.includes("execution reverted: 'D'") || errorMessage.includes("reverted: 'D'")) {
        // Special handling for the specific 'D' error
        errorMessage = "Transaction reverted with 'D' error - this typically indicates an invalid tick range. " +
          "The 'D' error usually means the ticks aren't properly aligned with the required tick spacing or the range is too wide/narrow. " +
          "Try a very narrow range close to the current price.";
      } else if (errorMessage.includes("execution reverted")) {
        // Extract the revert reason if available
        const revertMatch = errorMessage.match(/reverted: (.+?)(?:,|$)/);
        errorMessage = revertMatch ? 
          `Transaction reverted: ${revertMatch[1]}` : 
          "Transaction reverted by the contract";
      }
      
      setStatus(`Add Conc Liq failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }
  
  // Approve max tokens for easy testing
  async function approveMaxTokenIn() {
    if (!sdk || !isConnected) {
      setStatus("SDK not ready or wallet not connected");
      return;
    }
    
    try {
      // Проверка на нативный ETH
      if (tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase()) {
        setStatus("Native ETH does not require approval");
        return;
      }
      
      setStatus(`Approving max amount of ${tokenIn}...`);
      // У ETH и KING одинаковые децималы - 18
      const decimalsIn = 18;
      await approveToken(tokenIn, MaxUint256.toString(), decimalsIn);
      setStatus(`Max approval successful for ${tokenIn}`);
    } catch (error: any) {
      console.error("Max approval failed:", error);
      setStatus(`Max approval failed: ${error.message}`);
    }
  }
  
  async function approveMaxTokenOut() {
    if (!sdk || !isConnected) {
      setStatus("SDK not ready or wallet not connected");
      return;
    }
    
    try {
      // Проверка на нативный ETH
      if (tokenOut.toLowerCase() === ETH_ADDRESS.toLowerCase()) {
        setStatus("Native ETH does not require approval");
        return;
      }
      
      setStatus(`Approving max amount of ${tokenOut}...`);
      // У ETH и KING одинаковые децималы - 18
      const decimalsOut = 18;
      await approveToken(tokenOut, MaxUint256.toString(), decimalsOut);
      setStatus(`Max approval successful for ${tokenOut}`);
    } catch (error: any) {
      console.error("Max approval failed:", error);
      setStatus(`Max approval failed: ${error.message}`);
    }
  }
  
  // Check SDK methods - for debugging
  async function checkSdkMethods() {
    if (!sdk || !isConnected) {
      setStatus("SDK not ready or wallet not connected");
      return;
    }
    
    try {
      setStatus("Checking SDK methods...");
      console.log("=== SDK METHODS INSPECTION ===");
      
      // Display available CrocEnv methods
      console.log("CrocEnv methods:");
      const crocMethods = [];
      for (const method in sdk.croc) {
        if (typeof sdk.croc[method] === 'function') {
          console.log(`- sdk.croc.${method}`);
          crocMethods.push(method);
        }
      }
      console.log("Total CrocEnv methods:", crocMethods.length);
      
      // Check pool creation
      const baseToken = ETH_ADDRESS;
      const quoteToken = KING_SWELL;
      console.log(`\nCreating pool for ${baseToken}/${quoteToken}...`);
      const pool = sdk.croc.pool(baseToken, quoteToken);
      
      // Dump the entire pool object to see what's in it
      console.log("Pool object:", pool);
      
      // Display pool properties and methods
      console.log("Pool properties and methods:");
      const poolMethods = [];
      const poolProperties = [];
      for (const key in pool) {
        try {
          if (typeof pool[key] === 'function') {
            console.log(`- Method: pool.${key}`);
            poolMethods.push(key);
          } else {
            console.log(`- Property: pool.${key} =`, pool[key]);
            poolProperties.push(key);
          }
        } catch (err) {
          console.log(`- Error accessing ${key}:`, err.message);
        }
      }
      console.log("Total pool methods:", poolMethods.length);
      console.log("Total pool properties:", poolProperties.length);
      
      // Try some known methods that might be available
      const possibleMethods = ["getPoolPrice", "getPrice", "getSpotPrice", "currentPrice", "queryPrice"];
      
      console.log("\nTrying several possible price methods...");
      for (const method of possibleMethods) {
        try {
          if (typeof pool[method] === 'function') {
            console.log(`Trying pool.${method}()`);
            const result = await pool[method]();
            console.log(`Result from ${method}:`, result);
            setStatus(`Found working method: ${method}, result: ${result}`);
            break;
          }
        } catch (err) {
          console.log(`Error with ${method}:`, err.message);
        }
      }
      
      // Try using spotPrice from CrocEnv directly if available
      try {
        if (typeof sdk.croc.spotPrice === 'function') {
          console.log("Trying sdk.croc.spotPrice()");
          const spotPrice = await sdk.croc.spotPrice(baseToken, quoteToken);
          console.log("Spot price result:", spotPrice);
          setStatus(`SDK check complete! Price from spotPrice method: ${spotPrice}`);
        } else {
          console.log("croc.spotPrice method not available");
        }
      } catch (spotPriceError) {
        console.error("Failed to get spot price:", spotPriceError);
      }
      
      // Test swap functions to see which ones are available
      console.log("\nTesting swap functionality:");
      
      try {
        if (typeof sdk.croc.sellEth === 'function') {
          console.log("Found sellEth method");
          
          // Don't actually execute the swap, just verify the method chain works
          const swapBuilder = sdk.croc.sellEth(0.0001).for(quoteToken);
          console.log("Swap builder created:", swapBuilder);
          
          if (typeof swapBuilder.swap === 'function') {
            console.log("swap() method available on builder");
          }
          
          if (typeof swapBuilder.useBypass === 'function') {
            console.log("useBypass() method available on builder");
          }
        }
      } catch (error) {
        console.error("Error testing swap methods:", error);
      }
      
      // Check direct contract access
      try {
        console.log("\nTesting direct contract access:");
        const crocDexAbi = [
          "function userCmd(uint8 cmd, uint8 mode, bytes calldata params) external payable",
          "function swap(address base, address quote, uint256 poolIdx, bool isBuy, bool inBaseQty, uint256 qty, uint256 limitPrice, bytes calldata hookData) external payable returns (uint256 fillQty)",
        ];
        
        const dexContract = new Contract(DEX_ADDRESS, crocDexAbi, signer);
        console.log("Contract successfully created:", dexContract);
        
        // Don't actually call the contract, just verify we can create it
      } catch (contractError) {
        console.error("Contract access error:", contractError);
      }
      
      setStatus(`SDK check complete! See console for details.`);
    } catch (error: any) {
      console.error("SDK method check failed:", error);
      setStatus(`SDK check failed: ${error.message}`);
    }
  }

  if (!isConnected) {
    return <p>Please connect your wallet to use Ambient DEX features.</p>;
  }

  return (
    <div className="ambient-interaction">
      <h3>Interact with Ambient DEX on Swell Chain</h3>
      <div className={`status-box ${status.startsWith('Error') ? 'error' : status.includes('successful') ? 'success' : ''}`} 
           style={{ color: status.startsWith('Error') ? '#c62828' : status.includes('successful') ? '#2e7d32' : '#333333' }}>
        <strong>Status:</strong> {status}
      </div>
      
      <div className="interaction-section">
        <h4>Swap Tokens</h4>
        <div className="form-group">
          <label>Token In Address:</label>
          <input 
            type="text" 
            value={tokenIn} 
            onChange={(e) => setTokenIn(e.target.value)}
            disabled={isLoading}
          />
        </div>
        
        <div className="form-group">
          <label>Token Out Address:</label>
          <input 
            type="text" 
            value={tokenOut} 
            onChange={(e) => setTokenOut(e.target.value)}
            disabled={isLoading}
          />
        </div>
        
        <div className="form-group">
          <label>Amount In:</label>
          <input 
            type="text" 
            value={amountIn} 
            onChange={(e) => setAmountIn(e.target.value)}
            disabled={isLoading}
          />
        </div>
        
        <div className="approval-buttons" style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
          <button 
            onClick={approveMaxTokenIn} 
            disabled={isLoading || isSdkLoading || !sdk}
            style={{ 
              backgroundColor: '#4caf50',
              fontSize: '0.85rem',
              padding: '8px 10px'
            }}
          >
            Approve Max Token In
          </button>
          <button 
            onClick={approveMaxTokenOut} 
            disabled={isLoading || isSdkLoading || !sdk}
            style={{ 
              backgroundColor: '#4caf50',
              fontSize: '0.85rem',
              padding: '8px 10px'
            }}
          >
            Approve Max Token Out
          </button>
        </div>
        
        <button 
          onClick={handleSwap} 
          disabled={isLoading || isSdkLoading || !sdk}
        >
          Swap Tokens
        </button>
      </div>
      
      <div className="interaction-section">
        <h4>Add Ambient Liquidity</h4>
        <p>Uses the same token pair and amount as above</p>
        <button 
          onClick={handleAddAmbientLiq} 
          disabled={isLoading || isSdkLoading || !sdk}
        >
          Add Ambient Liquidity
        </button>
        
        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff8e1', borderRadius: '4px', fontSize: '0.9rem' }}>
          <strong>Note:</strong> Using small amount (0.001 ETH/KING) for testing. The button will try to add ambient liquidity by exploring available SDK methods.
        </div>
      </div>
      
      <div className="interaction-section">
        <h4>Add Concentrated Liquidity</h4>
        <div className="form-group">
          <label>Lower Price:</label>
          <input 
            type="text" 
            value={lowerPrice} 
            onChange={(e) => setLowerPrice(e.target.value)}
            disabled={isLoading}
          />
        </div>
        
        <div className="form-group">
          <label>Upper Price:</label>
          <input 
            type="text" 
            value={upperPrice} 
            onChange={(e) => setUpperPrice(e.target.value)}
            disabled={isLoading}
          />
        </div>
        
        <button 
          onClick={handleAddConcLiq} 
          disabled={isLoading || isSdkLoading || !sdk}
        >
          Add Concentrated Liquidity
        </button>
        
        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff8e1', borderRadius: '4px', fontSize: '0.9rem' }}>
          <strong>Note:</strong> Using small amount (0.001 ETH/KING) for testing. The button will try to add concentrated liquidity with the specified price range by exploring available SDK methods.
        </div>
      </div>
      
      <div className="interaction-section" style={{ marginTop: '30px', padding: '15px', backgroundColor: 'rgba(63, 81, 181, 0.1)', borderRadius: '8px' }}>
        <h4>SDK Debugging Tools</h4>
        <p style={{ fontSize: '0.9rem', color: '#555', marginBottom: '15px' }}>
          These tools help debug SDK functionality. Check the browser console for detailed output.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            onClick={checkSdkMethods} 
            disabled={isLoading || isSdkLoading || !sdk}
            style={{ 
              backgroundColor: '#8bc34a',
              color: '#fff'
            }}
          >
            Inspect SDK Methods and Pool Info
          </button>
          
          <button 
            onClick={async () => {
              if (!sdk?.signer || !address) {
                setStatus("Signer not available in SDK");
                return;
              }
              
              try {
                setStatus("Checking token approvals...");
                
                // Create contract instances
                const erc20Interface = [
                  "function allowance(address owner, address spender) view returns (uint256)",
                  "function decimals() view returns (uint8)",
                  "function symbol() view returns (string)"
                ];
                
                if (tokenIn.toLowerCase() !== ETH_ADDRESS.toLowerCase()) {
                  const inContract = new Contract(tokenIn, erc20Interface, signer);
                  const inAllowance = await inContract.allowance(address, DEX_ADDRESS);
                  const inDecimals = await inContract.decimals().catch(() => 18);
                  const inSymbol = await inContract.symbol().catch(() => tokenIn);
                  console.log(`${inSymbol} (${tokenIn}) allowance:`, inAllowance.toString());
                  console.log(`${inSymbol} decimals:`, inDecimals);
                  const formattedAllowance = formatUnits(inAllowance, inDecimals);
                  setStatus(`${inSymbol} approval: ${formattedAllowance} tokens`);
                }
                
                if (tokenOut.toLowerCase() !== ETH_ADDRESS.toLowerCase() && 
                    tokenOut.toLowerCase() !== tokenIn.toLowerCase()) {
                  const outContract = new Contract(tokenOut, erc20Interface, signer);
                  const outAllowance = await outContract.allowance(address, DEX_ADDRESS);
                  const outDecimals = await outContract.decimals().catch(() => 18);
                  const outSymbol = await outContract.symbol().catch(() => tokenOut);
                  console.log(`${outSymbol} (${tokenOut}) allowance:`, outAllowance.toString());
                  console.log(`${outSymbol} decimals:`, outDecimals);
                  const formattedAllowance = formatUnits(outAllowance, outDecimals);
                  setStatus(`${outSymbol} approval: ${formattedAllowance} tokens`);
                }
                
                if (tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase() || 
                    tokenOut.toLowerCase() === ETH_ADDRESS.toLowerCase()) {
                  setStatus(prev => prev + " (ETH doesn't require approval)");
                }
                
              } catch (error) {
                console.error("Failed to check approvals:", error);
                setStatus(`Failed to check approvals: ${error.message}`);
              }
            }}
            disabled={isLoading || isSdkLoading || !sdk}
            style={{ 
              backgroundColor: '#3f51b5',
              color: '#fff'
            }}
          >
            Check Token Approvals
          </button>
        </div>
      </div>
    </div>
  );
}