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
        console.log("Pool created:", pool);
        console.log("Base token:", pool.baseToken.tokenAddr);
        console.log("Quote token:", pool.quoteToken.tokenAddr);
        
        // Определяем, какой токен мы используем для добавления ликвидности
        const usingBaseToken = tokenIn.toLowerCase() === pool.baseToken.tokenAddr.toLowerCase();
        console.log("Using base token:", usingBaseToken);
        
        // Для concentrated liquidity нам нужно конвертировать цены в тики
        // Получаем текущую цену для информации
        const currentSpotPrice = await pool.spotPrice();
        console.log("Current spot price:", currentSpotPrice);
        
        // Для проверки выведем текущий тик
        const currentTick = await pool.spotTick();
        console.log("Current tick:", currentTick);
        
        // Пробуем также получить текущий тик через displayToNeighborTicks
        try {
          const currentDisplayPrice = await pool.displayPrice();
          console.log("Current display price:", currentDisplayPrice);
          const neighborTicks = await pool.displayToNeighborTicks(currentDisplayPrice);
          console.log("Neighbor ticks:", neighborTicks);
        } catch (tickError) {
          console.error("Error fetching neighbor ticks:", tickError);
        }
        
        // Конвертируем цены в тики - используем подход log base 1.0001
        
        // Issue with the "D" error is likely due to tick spacing requirements
        // Ambient DEX (CrocSwap) likely requires ticks to be on specific spacings
        
        // Use the current tick we already obtained above
        console.log("Working with current tick:", currentTick);
        
        // Create super narrow range very close to current tick
        // Try extremely narrow ranges for best chance of success
        // Try a super tight range of just ±1 tick (minimum possible range)
        const superTightRange = [currentTick - 1, currentTick + 1];
        console.log("Super tight range (±1 from current):", superTightRange);
        
        // Try a very narrow range of just ±5 ticks from current tick
        const narrowTickRange = [currentTick - 5, currentTick + 5];
        console.log("Narrow tick range (±5 from current):", narrowTickRange);
        
        // Very conservative tick range (±20)
        const conservativeTickRange = [currentTick - 20, currentTick + 20];
        console.log("Conservative tick range (±20 from current):", conservativeTickRange);
        
        // Create tick range based on neighbors of current tick
        // This should respect tick spacing requirements of the protocol
        let neighborTickRange;
        try {
          const currentDisplayPrice = await pool.displayPrice();
          console.log("Current display price:", currentDisplayPrice);
          const neighborTicks = await pool.displayToNeighborTicks(currentDisplayPrice);
          console.log("Neighbor ticks:", neighborTicks);
          
          // Use the neighbor ticks if available (these should respect spacing)
          if (neighborTicks && neighborTicks.length >= 2) {
            // Sort neighbor ticks to ensure proper order
            neighborTickRange = [
              Math.min(neighborTicks[0], neighborTicks[1]), 
              Math.max(neighborTicks[0], neighborTicks[1])
            ];
            console.log("Using neighbor tick range:", neighborTickRange);
          }
        } catch (tickError) {
          console.error("Error fetching neighbor ticks:", tickError);
          // Continue with other approaches if this fails
        }
        
        // Try different tick spacing values - Ambient/CrocSwap likely has specific requirements
        // Common tick spacing values are: 1, 10, 60, 200 (based on different fee tiers in Uniswap V3)
        const tickSpacingRanges = [];
        
        // Try with tick spacing = 1 (finest granularity)
        const spacing1 = 1;
        tickSpacingRanges.push([
          Math.floor(currentTick / spacing1) * spacing1 - spacing1,
          Math.ceil(currentTick / spacing1) * spacing1 + spacing1
        ]);
        
        // Try with tick spacing = 10 (0.1% fee tier in Uniswap V3)
        const spacing10 = 10;
        tickSpacingRanges.push([
          Math.floor(currentTick / spacing10) * spacing10 - spacing10,
          Math.ceil(currentTick / spacing10) * spacing10 + spacing10
        ]);
        
        // Try with tick spacing = 60 (0.3% fee tier in Uniswap V3)
        const spacing60 = 60;
        tickSpacingRanges.push([
          Math.floor(currentTick / spacing60) * spacing60 - spacing60,
          Math.ceil(currentTick / spacing60) * spacing60 + spacing60
        ]);
        
        // Try with tick spacing = 200 (1% fee tier in Uniswap V3)
        const spacing200 = 200;
        tickSpacingRanges.push([
          Math.floor(currentTick / spacing200) * spacing200 - spacing200,
          Math.ceil(currentTick / spacing200) * spacing200 + spacing200
        ]);
        
        console.log("Generated tick spacing ranges:", tickSpacingRanges);
        
        // Old approach for reference but not primary
        // Precompute ticks from price using logarithmic formula
        const lowerPriceSqrt = Math.sqrt(sortedPriceRange[0]);
        const upperPriceSqrt = Math.sqrt(sortedPriceRange[1]);
        const lowerTick = Math.floor(Math.log(lowerPriceSqrt) / Math.log(1.0001));
        const upperTick = Math.ceil(Math.log(upperPriceSqrt) / Math.log(1.0001));
        const userTickRange = [lowerTick, upperTick]; 
        console.log("User-provided tick range:", userTickRange);
        
        // Try to use SDK-provided methods to get valid tick ranges
        let sdkTickRange;
        try {
          // Check if there's a direct SDK method for calculating valid ticks
          if (typeof pool.getValidTicks === 'function') {
            console.log("Using pool.getValidTicks() to get valid tick range");
            const validTicks = await pool.getValidTicks(currentTick, 2); // Get 2 ticks around current
            sdkTickRange = [Math.min(...validTicks), Math.max(...validTicks)];
            console.log("SDK valid tick range:", sdkTickRange);
          } else if (typeof pool.nearestValidTicks === 'function') {
            console.log("Using pool.nearestValidTicks() to get valid tick range");
            const validTicks = await pool.nearestValidTicks(currentTick, 2);
            sdkTickRange = [Math.min(...validTicks), Math.max(...validTicks)];
            console.log("SDK valid tick range:", sdkTickRange);
          } else if (typeof sdk.croc.tickMath === 'object' && typeof sdk.croc.tickMath.getValidTicks === 'function') {
            console.log("Using sdk.croc.tickMath.getValidTicks()");
            const validTicks = await sdk.croc.tickMath.getValidTicks(currentTick, 2);
            sdkTickRange = [Math.min(...validTicks), Math.max(...validTicks)];
            console.log("SDK tickMath valid range:", sdkTickRange);
          }
        } catch (sdkTickError) {
          console.error("Error getting SDK tick range:", sdkTickError);
        }
        
        // Create a tick range array with all our calculated ranges in priority order
        const tickRangeOptions = [
          sdkTickRange,      // SDK-provided tick range (most likely to work if available)
          neighborTickRange, // Use neighbor ticks if available (most likely to work)
          superTightRange,   // Extremely narrow range (±1 tick)
          narrowTickRange,   // Very narrow range (±5 ticks)
          ...tickSpacingRanges, // Try all our different tick spacing ranges
          conservativeTickRange, // Slightly wider but still conservative
          [currentTick - 100, currentTick + 100], // Wider range around current tick
          userTickRange      // User provided range (least likely to work)
        ].filter(range => range !== undefined);
        
        console.log("Will try tick ranges in this order:", tickRangeOptions);
        
        // Используем широкие пределы цен для исполнения (slippage protection)
        const priceLimits = [currentSpotPrice * 0.5, currentSpotPrice * 1.5];
        console.log("Price limits:", priceLimits);
        
        // Преобразуем диапазон цен в диапазон отображаемых цен
        const dispPriceLimits = await Promise.all(priceLimits.map(p => pool.toDisplayPrice(p)));
        console.log("Display price limits:", dispPriceLimits);
        
        setStatus(`Adding ${testAmount} ${usingBaseToken ? 'base' : 'quote'} token as concentrated liquidity...`);
        
        // Get transaction details before sending
        let txDetails;
        let successfulRange = null;
        
        // Try each tick range option until one works
        for (const [index, rangeOption] of tickRangeOptions.entries()) {
          try {
            console.log(`\nAttempting with tick range option ${index + 1}:`, rangeOption);
            
            // Use pool.mintRange* methods to get transaction details
            if (usingBaseToken) {
              const method = 'mintRangeBase';
              console.log(`Preparing transaction: ${method}(${amountInFloat}, [${rangeOption[0]}, ${rangeOption[1]}], [${priceLimits[0]}, ${priceLimits[1]}], { surplus: false })`);
              txDetails = await pool.mintRangeBase.populateTransaction(
                amountInFloat, 
                rangeOption, 
                priceLimits, 
                { surplus: false }
              );
            } else {
              const method = 'mintRangeQuote';
              console.log(`Preparing transaction: ${method}(${amountInFloat}, [${rangeOption[0]}, ${rangeOption[1]}], [${priceLimits[0]}, ${priceLimits[1]}], { surplus: false })`);
              txDetails = await pool.mintRangeQuote.populateTransaction(
                amountInFloat, 
                rangeOption, 
                priceLimits, 
                { surplus: false }
              );
            }
            
            // Log transaction details for debugging
            console.log(`=== TRANSACTION DETAILS FOR RANGE OPTION ${index + 1} ===`);
            console.log("From:", address);
            console.log("To:", txDetails.to);
            console.log("Value:", txDetails.value?.toString() || "0");
            console.log("Data:", txDetails.data);
            console.log("=== END TRANSACTION DETAILS ===");
            
            // If we get here, the range is potentially valid
            successfulRange = rangeOption;
            console.log(`✅ Tick range option ${index + 1} looks valid!`);
            break;
            
          } catch (rangeError) {
            console.error(`❌ Error with tick range option ${index + 1}:`, rangeError.message);
            // Continue to the next range option
          }
        }
        
        if (!successfulRange) {
          throw new Error("All tick range options failed - could not find valid tick range");
        }
        
        console.log("Using successful tick range:", successfulRange);
        setStatus(`Adding concentrated liquidity with tick range [${successfulRange[0]}, ${successfulRange[1]}]...`);
        
        // Вызываем соответствующий метод для добавления концентрированной ликвидности
        let tx;
        
        try {
          console.log("Submitting transaction with successful tick range...");
          
          // Try using smaller slippage here to avoid issues
          const tightPriceLimits = [currentSpotPrice * 0.9, currentSpotPrice * 1.1]; 
          console.log("Using tight price limits for execution:", tightPriceLimits);
          
          if (usingBaseToken) {
            // Добавляем ликвидность, используя base token
            tx = await pool.mintRangeBase(
              amountInFloat, 
              successfulRange, 
              tightPriceLimits, // Use tight price limits
              { surplus: false }
            );
          } else {
            // Добавляем ликвидность, используя quote token
            tx = await pool.mintRangeQuote(
              amountInFloat, 
              successfulRange, 
              tightPriceLimits, // Use tight price limits
              { surplus: false }
            );
          }
        } catch (submissionError) {
          console.error("Error submitting transaction:", submissionError);
          
          // Special handling for 'D' error
          if (submissionError.message.includes("reverted: 'D'")) {
            console.log("=== 'D' ERROR DETAILS ===");
            console.log("Current tick:", currentTick);
            console.log("Using tick range:", successfulRange);
            console.log("Tick spacing check:", successfulRange[0] % 10, successfulRange[1] % 10);
            console.log("Price limits:", tightPriceLimits);
            console.log("Base token:", pool?.baseToken?.tokenAddr);
            console.log("Quote token:", pool?.quoteToken?.tokenAddr);
            console.log("Adding liquidity as:", usingBaseToken ? "base" : "quote");
            console.log("========================");
            
            throw new Error(
              "Error 'D' usually indicates an invalid tick range or price limit. " +
              "The contract is rejecting the input parameters. " +
              "Current tick is " + currentTick + ". " +
              "We tried tick range [" + successfulRange[0] + ", " + successfulRange[1] + "]. " +
              "Try selecting smaller price range inputs or refer to console for diagnostic info."
            );
          }
          
          // Rethrow the original error
          throw submissionError;
        }
        
        setStatus(`Add Conc Liq Tx sent: ${tx.hash}. Waiting...`);
        console.log("Transaction hash:", tx.hash);
        
        await tx.wait();
        setStatus(`Add Conc Liq successful! Tx: ${tx.hash}`);
        
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
          "The range may be too wide, not aligned with tick spacing, or outside allowed bounds. " +
          "Current tick is around " + currentTick + ". Try a very narrow range close to this tick.";
          
        console.log("=== DIAGNOSTIC INFO FOR 'D' ERROR ===");
        console.log("Current tick:", currentTick);
        console.log("Pool base token:", pool?.baseToken?.tokenAddr);
        console.log("Pool quote token:", pool?.quoteToken?.tokenAddr);
        console.log("Using base token:", usingBaseToken);
        console.log("Successful tick range tried:", successfulRange);
        console.log("All attempted tick ranges:", tickRangeOptions);
        console.log("Price limits used:", priceLimits);
        console.log("Spot price:", currentSpotPrice);
        console.log("===============================");
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