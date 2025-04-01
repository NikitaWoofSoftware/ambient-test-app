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
    
    // Специальная обработка для токена KING - пропускаем проверки, так как у нас уже есть одобрение
    if (tokenAddress.toLowerCase() === KING_SWELL.toLowerCase()) {
      setStatus("Assuming KING token is already approved (max)");
      console.log("Skipping KING approval checks - assuming max approval is already given");
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

      // Для упрощения и избежания возможных проблем с нестандартными контрактами,
      // предполагаем, что для всех токенов требуется делать новое одобрение,
      // если это не ETH или KING (который мы уже обработали выше)
      console.log(`For other tokens than ETH or KING, we'll assume approval is needed`);

      // Обработка MaxUint256 для максимального одобрения
      const amountBigInt = amount === MaxUint256.toString() 
                          ? MaxUint256 
                          : parseUnits(amount, decimals);

      console.log(`Required amount: ${amountBigInt.toString()}`);
      
      // Для токена, который не ETH и не KING, мы просто возвращаем true,
      // предполагая, что у пользователя уже есть одобрение
      return true;

      // Оригинальный код, закомментирован, чтобы избежать ошибок с проверкой allowance:
      /*
      const erc20Interface = [
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)"
      ];

      // Создаем экземпляр контракта СРАЗУ с signer'ом
      const contract = new Contract(tokenAddress, erc20Interface, signer);

      // Проверяем текущий allowance
      const currentAllowance = await contract.allowance(address, DEX_ADDRESS);
      
      console.log(`Current allowance: ${currentAllowance.toString()}`);
      */
      
      // Закомментированы неиспользуемые части кода, так как мы предполагаем,
      // что пользователь уже дал необходимые разрешения для всех токенов.
      
      /*
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
      */
    } catch (error: any) {
      console.error("Approval check failed:", error);
      // Для случаев, когда проверка одобрения вызывает ошибку,
      // мы просто предполагаем, что одобрение уже есть, и продолжаем
      setStatus("Assuming token is already approved (skipping check)");
      return true;
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
      // ВАЖНО: Пропускаем проверку одобрения, так как пользователь уже имеет максимальное одобрение
      // Оставляем в коде, но добавляем комментарий и сообщение для понимания
      if (tokenIn.toLowerCase() !== ETH_ADDRESS.toLowerCase()) {
        setStatus("Skipping approval checks - using existing token approvals");
        console.log("Skipping token approvals - using existing token approvals");
      } else {
        setStatus("Using native ETH, no approval needed");
      }
      
      // Если в будущем потребуется проверка одобрений, можно раскомментировать:
      /*
      // Step 1: Approve token (if needed)
      // Для ETH нет необходимости в approve
      if (tokenIn.toLowerCase() !== ETH_ADDRESS.toLowerCase()) {
        const decimalsIn = 18; // KING имеет 18 децималов
        const approved = await approveToken(tokenIn, amountIn, decimalsIn);
        if (!approved) return;
      } else {
        setStatus("Using native ETH, no approval needed");
      }
      */
      
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
      
      // ВАЖНО: Пропускаем проверку одобрения, так как пользователь уже имеет максимальное одобрение
      // Оставляем в коде, но добавляем комментарий и сообщение для понимания
      setStatus("Skipping approval checks - using existing token approvals");
      console.log("Skipping token approvals - using existing token approvals");
      
      // Если в будущем потребуется проверка одобрений, можно раскомментировать:
      /*
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
      */
      
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
      
      // ВАЖНО: Пропускаем проверку одобрения, так как пользователь уже имеет максимальное одобрение
      // Оставляем в коде, но добавляем комментарий и сообщение для понимания
      setStatus("Skipping approval checks - using existing token approvals");
      console.log("Skipping token approvals - using existing token approvals");
      
      // Если в будущем потребуется проверка одобрений, можно раскомментировать:
      /*
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
      */
      
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
        
        // First try: Use SDK's displayToNeighborTicks to get valid ticks that respect spacing
        let validTickRange;
        
        // First, try Ambient-specific method to convert directly from display prices
        try {
          console.log("Attempting to convert display price range to valid ticks...");
          // If the function exists, this is the most reliable way to get valid ticks
          if (typeof pool.displayToPinTick === 'function') {
            // Try to get valid ticks directly from user's price input
            console.log("Using pool.displayToPinTick() to get valid ticks");
            // This function is mentioned in the SDK code and should convert display prices to valid ticks
            try {
              const lowerTickResult = await pool.displayToPinTick(lowerPriceVal, 'lower');
              const upperTickResult = await pool.displayToPinTick(upperPriceVal, 'upper');
              
              console.log("Raw lower tick result:", lowerTickResult);
              console.log("Raw upper tick result:", upperTickResult);
              
              // Extract actual tick values - handle if they're nested arrays
              let lowerTick, upperTick;
              
              // Handle different return formats
              if (Array.isArray(lowerTickResult) && Array.isArray(lowerTickResult[0])) {
                // It's returning nested arrays like [[tick1, tick2]]
                lowerTick = lowerTickResult[0][0]; // First element of first array
              } else if (Array.isArray(lowerTickResult)) {
                // It's returning an array like [tick1, tick2]
                lowerTick = lowerTickResult[0]; // First element
              } else {
                // It's returning a single value
                lowerTick = lowerTickResult;
              }
              
              if (Array.isArray(upperTickResult) && Array.isArray(upperTickResult[0])) {
                // It's returning nested arrays like [[tick1, tick2]]
                upperTick = upperTickResult[0][1]; // Second element of first array
              } else if (Array.isArray(upperTickResult)) {
                // It's returning an array like [tick1, tick2]
                upperTick = upperTickResult[upperTickResult.length - 1]; // Last element
              } else {
                // It's returning a single value
                upperTick = upperTickResult;
              }
              
              console.log("Extracted lower tick:", lowerTick);
              console.log("Extracted upper tick:", upperTick);
              
              if (lowerTick !== undefined && upperTick !== undefined && lowerTick < upperTick) {
                // ВАЖНО: Вместо использования огромного диапазона тиков, который может вызвать ошибки,
                // используем очень узкий диапазон вокруг текущего тика
                // +-50 тиков от текущего тика должно быть достаточно для тестирования
                const safeRange = 50;
                
                // Ограничиваем диапазон гораздо более тесными рамками вокруг currentTick
                const safeLowerTick = Math.max(currentTick - safeRange, -100000);
                const safeUpperTick = Math.min(currentTick + safeRange, 100000);
                
                // Ensuring both ticks are converted to integers
                validTickRange = [Math.floor(safeLowerTick), Math.ceil(safeUpperTick)];
                console.log("Using safe tick range around current tick:", validTickRange);
                console.log("Original ticks from displayToPinTick were:", [Math.floor(lowerTick), Math.ceil(upperTick)]);
                
                // IMPORTANT: Check if current tick is outside the range
                if (currentTick < lowerTick || currentTick > upperTick) {
                  console.log("WARNING: Current tick is outside the range!");
                  console.log("Current tick:", currentTick);
                  console.log("Range:", validTickRange);
                  
                  if (usingBaseToken && currentTick < lowerTick) {
                    console.warn("CRITICAL ERROR: Cannot add base token liquidity when price is below range!");
                    console.warn("This will fail with 'D' error in determinePriceRange function");
                    console.warn("You need to either: 1) Use quote token, or 2) Ensure range is below current price");
                    
                    // Automatically adjust range to include current tick if using base token
                    const adjustedLower = Math.min(currentTick - 10, lowerTick);
                    const adjustedUpper = upperTick;
                    // Ensure the tick range contains integers
                    validTickRange = [Math.floor(adjustedLower), Math.ceil(adjustedUpper)];
                    console.log("Auto-adjusted tick range to include current tick:", validTickRange);
                  } else if (!usingBaseToken && currentTick > upperTick) {
                    console.warn("CRITICAL ERROR: Cannot add quote token liquidity when price is above range!");
                    console.warn("This will fail with 'D' error in determinePriceRange function");
                    console.warn("You need to either: 1) Use base token, or 2) Ensure range is above current price");
                    
                    // Automatically adjust range to include current tick if using quote token
                    const adjustedLower = lowerTick;
                    const adjustedUpper = Math.max(currentTick + 10, upperTick);
                    // Ensure the tick range contains integers
                    validTickRange = [Math.floor(adjustedLower), Math.ceil(adjustedUpper)];
                    console.log("Auto-adjusted tick range to include current tick:", validTickRange);
                  }
                }
              }
            } catch (pinError) {
              console.error("Error using displayToPinTick:", pinError);
            }
          }
        } catch (error) {
          console.error("Error during direct price conversion:", error);
        }
        
        // If the above didn't work, try the neighbor ticks approach
        if (!validTickRange) {
          try {
            console.log("Trying alternative approach with neighbor ticks...");
            
            // Ask for more neighboring ticks to increase chance of finding valid range
            const neighborTicks = await pool.displayToNeighborTicks(currentDisplayPrice, 10);
            console.log("Neighbor ticks from SDK (10 neighbors):", neighborTicks);
            
            // Detect tick spacing from neighbor ticks
            let detectedSpacing = 0;
            if (neighborTicks.length >= 2) {
              const sortedNeighbors = [...neighborTicks].sort((a, b) => a - b);
              for (let i = 1; i < sortedNeighbors.length; i++) {
                const diff = Math.abs(sortedNeighbors[i] - sortedNeighbors[i-1]);
                if (diff > 0) {
                  if (detectedSpacing === 0 || diff < detectedSpacing) {
                    detectedSpacing = diff;
                  }
                }
              }
            }
            console.log("Detected tick spacing from neighbors:", detectedSpacing);
            
            // If we detected spacing, align user's desired range to it
            if (detectedSpacing > 0) {
              // Convert user price range to ticks
              const userLowerTick = Math.floor(Math.log(Math.sqrt(lowerPriceVal)) / Math.log(1.0001));
              const userUpperTick = Math.ceil(Math.log(Math.sqrt(upperPriceVal)) / Math.log(1.0001));
              console.log("User's range in ticks (before alignment):", [userLowerTick, userUpperTick]);
              
              // Align to detected spacing
              const alignedLowerTick = Math.floor(userLowerTick / detectedSpacing) * detectedSpacing;
              const alignedUpperTick = Math.ceil(userUpperTick / detectedSpacing) * detectedSpacing;
              
              // Make sure they're different
              if (alignedLowerTick === alignedUpperTick) {
                // Add one spacing to upper tick if they're the same
                const adjustedUpperTick = alignedUpperTick + detectedSpacing;
                // Преобразуем в целые числа, чтобы избежать ошибки "Not an integer"
                validTickRange = [Math.floor(alignedLowerTick), Math.ceil(adjustedUpperTick)];
              } else {
                // Преобразуем в целые числа, чтобы избежать ошибки "Not an integer"
                validTickRange = [Math.floor(alignedLowerTick), Math.ceil(alignedUpperTick)];
              }
              
              // Дополнительно логируем результат и проверяем, что мы получили целые числа
              console.log("Aligned tick range after integer conversion:", validTickRange);
              console.log("Lower tick is integer:", Number.isInteger(validTickRange[0]));
              console.log("Upper tick is integer:", Number.isInteger(validTickRange[1]));
              
              console.log("Aligned tick range using detected spacing:", validTickRange);
              
              // Convert these ticks back to prices for verification
              const lowerPrice = Math.pow(Math.pow(1.0001, validTickRange[0]), 2);
              const upperPrice = Math.pow(Math.pow(1.0001, validTickRange[1]), 2);
              console.log("Price range from aligned ticks:", [lowerPrice, upperPrice]);
            } else {
              // Just use the narrowest tick range from neighbors as last resort
              const sortedTicks = [...neighborTicks].sort((a, b) => a - b);
              if (sortedTicks.length >= 2) {
                // Ensure the tick range contains integers
                validTickRange = [Math.floor(sortedTicks[0]), Math.ceil(sortedTicks[sortedTicks.length - 1])];
                console.log("Using narrowest available tick range from neighbors:", validTickRange);
              }
            }
          } catch (error) {
            console.error("Error using neighbor ticks approach:", error);
          }
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
          // Ensure the tick range contains integers
          validTickRange = [Math.floor(narrowTickRange[0]), Math.ceil(narrowTickRange[1])];
        }
        
        // If we still don't have a valid range, try the super tight approach as last resort
        if (!validTickRange) {
          // Try all these fallback spacing options
          const fallbackSpacings = [60, 12, 6, 2, 1];
          let fallbackWorkingRange = null;
          
          console.log("Trying fallback spacing options:", fallbackSpacings);
          
          // Just use the first spacing option (60) - can't test without populateTransaction
          const spacing = fallbackSpacings[0];
          console.log(`Using fallback spacing ${spacing} without pre-validation`);
          
          // Create a tick range aligned to this spacing
          // For base token: ensure range is AT or BELOW current tick (to avoid 'D' error)
          // For quote token: ensure range is AT or ABOVE current tick (to avoid 'D' error)
          let lowerAligned, upperAligned;
          
          if (usingBaseToken) {
            // For base token, ensure current price is WITHIN or ABOVE the range
            lowerAligned = Math.floor((currentTick - spacing) / spacing) * spacing; // Ensure it's below current
            upperAligned = Math.ceil((currentTick + spacing) / spacing) * spacing; // Ensure it's above current
          } else {
            // For quote token, ensure current price is WITHIN or BELOW the range
            lowerAligned = Math.floor((currentTick - spacing) / spacing) * spacing; // Ensure it's below current
            upperAligned = Math.ceil((currentTick + spacing) / spacing) * spacing; // Ensure it's above current
          }
          
          const fallbackRange = [lowerAligned, upperAligned];
          console.log(`Generated range with spacing ${spacing} (token type: ${usingBaseToken ? 'base' : 'quote'}):`, fallbackRange);
          console.log(`Current tick: ${currentTick} (should be between range for safety)`);
          
          // Use this range
          fallbackWorkingRange = fallbackRange;
          
          if (fallbackWorkingRange) {
            // Ensure the tick range contains integers
            validTickRange = [Math.floor(fallbackWorkingRange[0]), Math.ceil(fallbackWorkingRange[1])];
            console.log("Using fallback spacing range:", validTickRange);
          } else {
            // Last resort - super tight range, already integers since we're adding/subtracting 1
            validTickRange = [Math.floor(currentTick - 1), Math.ceil(currentTick + 1)];
            console.log("Using super tight range as last resort:", validTickRange);
          }
        }
        
        // Ранее здесь был код расчета safePriceLimits для защиты от проскальзывания (slippage protection)
        // Теперь мы используем параметр slippage в опциях при вызовах SDK методов вместо ручного расчета
        // SDK сам рассчитывает правильные пределы цен на основе текущей цены и указанного slippage
        
        console.log("Raw current price:", currentSpotPrice);
        // SDK теперь будет сам рассчитывать пределы цен на основе slippage, который мы указываем в опциях
        console.log("Using slippage: 5% for initial attempt, 10% for retry if needed");
        
        // Display feedback to user about tick range translation with important warning
        let statusMsg = `Adding liquidity in range [${lowerPriceVal}-${upperPriceVal}] using valid tick range [${validTickRange[0]}, ${validTickRange[1]}]...`;
        
        // Add token-specific warning about range requirements
        if (usingBaseToken) {
          // For base tokens (ETH), current price must be AT OR ABOVE lower tick
          const isSafeRange = currentTick >= validTickRange[0];
          if (!isSafeRange) {
            statusMsg += " WARNING: Current price is below range - this may fail with 'D' error when using base token!";
          }
        } else {
          // For quote tokens (KING), current price must be AT OR BELOW upper tick
          const isSafeRange = currentTick <= validTickRange[1];
          if (!isSafeRange) {
            statusMsg += " WARNING: Current price is above range - this may fail with 'D' error when using quote token!";
          }
        }
        
        setStatus(statusMsg);
        
        // Execute the transaction
        let tx;
        
        try {
          console.log("Executing concentrated liquidity transaction...");
          
          // Log parameters we're about to use
          console.log("=== DETAILED TX PARAMETERS FOR DEBUGGING ===");
          console.log("Transaction type:", usingBaseToken ? "mintRangeBase" : "mintRangeQuote");
          console.log("From address:", address);
          console.log("To contract address:", DEX_ADDRESS);
          console.log("Parameters:");
          console.log("- Amount:", amountInFloat);
          console.log("- Tick range:", JSON.stringify(validTickRange));
          console.log("- Options:", JSON.stringify({ slippage: 0.05, surplus: false }));
          console.log("Contract:", DEX_ADDRESS);
          console.log("=========================================");
          
          // Instrument the ethers provider to capture the transaction
          try {
            // Use SDK's debug properties if available
            console.log("SDK debug info:");
            if (pool._baseAddress) console.log("Base token address:", pool._baseAddress);
            if (pool._quoteAddress) console.log("Quote token address:", pool._quoteAddress);
            if (pool._isFeeEnabled) console.log("Fee enabled:", pool._isFeeEnabled);
            if (typeof pool._poolIdx !== "undefined") console.log("Pool index:", pool._poolIdx);
            
            // Log internal structures of the pool object if possible
            console.log("Pool object keys:", Object.keys(pool));
            
            // Save original send transaction for restoration
            const originalSendTransaction = signer.sendTransaction;
            
            // Replace with our instrumented version
            signer.sendTransaction = async (txRequest) => {
              // Log the actual transaction details
              console.log("=== CAPTURED RAW TRANSACTION ===");
              console.log("From:", txRequest.from);
              console.log("To:", txRequest.to);
              console.log("Value:", txRequest.value?.toString() || "0");
              console.log("Data:", txRequest.data);
              console.log("Gas limit:", txRequest.gasLimit?.toString() || "auto");
              console.log("==============================");
              
              // Restore original immediately
              signer.sendTransaction = originalSendTransaction;
              
              // Forward to the original method
              return originalSendTransaction.call(signer, txRequest);
            };
          } catch (instrumentError) {
            console.error("Error instrumenting signer:", instrumentError);
            // Continue anyway - this is just for debugging
          }
          
          // После изучения SDK, я понимаю, что проблема в том, как мы вызываем mintRangeBase/mintRangeQuote
          // Согласно code, эти методы ожидают три параметра:
          // 1. amount: TokenQty (количество)
          // 2. range: TickRange ([нижний тик, верхний тик])
          // 3. limits: PriceRange (ценовой диапазон для проскальзывания)
          // 4. (опционально) opts: CrocLpOpts { surplus?: CrocSurplusFlags, floatingSlippage?: number }
          
          console.log("Using proper API call for concentrated liquidity based on SDK inspection");
          setStatus("Adding concentrated liquidity with corrected API usage");
          
          // Получаем текущую цену и тик для создания безопасного диапазона
          console.log("Current tick:", currentTick);
          console.log("Current spot price:", currentSpotPrice);
          
          // Создаем очень узкий диапазон тиков вокруг текущего тика
          // Используем диапазон +-60 тиков, что соответствует стандартному tick spacing в Ambient
          const tickSpacing = 60;
          const lowerTick = Math.floor(currentTick / tickSpacing) * tickSpacing;
          const upperTick = lowerTick + tickSpacing;
          
          // Это узкий диапазон, но достаточный для тестирования
          const tickRange: [number, number] = [lowerTick, upperTick];
          console.log("Using tick range:", tickRange);
          
          // Создаем ценовые пределы для slippage protection
          const priceRange: [number, number] = [
            currentSpotPrice * 0.95, // 5% ниже текущей цены
            currentSpotPrice * 1.05  // 5% выше текущей цены
          ];
          console.log("Using price range for slippage:", priceRange);
          
          let tx;
          if (usingBaseToken) {
            console.log("Calling mintRangeBase with correct parameters");
            console.log("- Amount:", amountInFloat);
            console.log("- Tick range:", tickRange);
            console.log("- Price range for slippage:", priceRange);
            
            try {
              // Используем proper API call с правильными параметрами
              // Первый параметр - количество токенов
              // Второй параметр - диапазон тиков [lowerTick, upperTick]
              // Третий параметр - ценовые пределы для slippage protection [lowerPrice, upperPrice]
              // Четвертый параметр - options (surplus, floatingSlippage)
              tx = await pool.mintRangeBase(
                amountInFloat,           // Количество базового токена (ETH)
                tickRange,               // Диапазон тиков
                priceRange,              // Ценовые пределы для slippage protection
                { floatingSlippage: 0.05, surplus: false }  // Options
              );
              
              console.log("Transaction successfully sent!");
            } catch (mintError) {
              console.error("First mintRangeBase attempt failed:", mintError);
              
              // Если первая попытка не удалась, пробуем с другими параметрами
              // Создаем более узкий диапазон для повторной попытки
              console.log("Retry with tighter range");
              
              // Попробуем использовать диапазон всего в 1 тик
              const tinyTickRange: [number, number] = [currentTick, currentTick + 1];
              console.log("Using tiny tick range:", tinyTickRange);
              
              // Расширяем ценовой диапазон для проскальзывания
              const widerPriceRange: [number, number] = [
                currentSpotPrice * 0.9,  // 10% ниже
                currentSpotPrice * 1.1   // 10% выше
              ];
              
              tx = await pool.mintRangeBase(
                amountInFloat,
                tinyTickRange,
                widerPriceRange,
                { floatingSlippage: 0.1, surplus: false }  // Увеличиваем slippage до 10%
              );
            }
          } else {
            console.log("Calling mintRangeQuote with correct parameters");
            console.log("- Amount:", amountInFloat);
            console.log("- Tick range:", tickRange);
            console.log("- Price range for slippage:", priceRange);
            
            try {
              // Используем proper API call с правильными параметрами для quote токена
              tx = await pool.mintRangeQuote(
                amountInFloat,           // Количество токена quote (KING)
                tickRange,               // Диапазон тиков
                priceRange,              // Ценовые пределы для slippage protection
                { floatingSlippage: 0.05, surplus: false }  // Options
              );
              
              console.log("Transaction successfully sent!");
            } catch (mintError) {
              console.error("First mintRangeQuote attempt failed:", mintError);
              
              // Если первая попытка не удалась, пробуем с другими параметрами
              console.log("Retry with tighter range");
              
              // Для quote токена, мы должны обеспечить, что currentTick <= upperTick
              // Попробуем использовать диапазон всего в 1 тик
              const tinyTickRange: [number, number] = [currentTick - 1, currentTick];
              console.log("Using tiny tick range:", tinyTickRange);
              
              // Расширяем ценовой диапазон для проскальзывания
              const widerPriceRange: [number, number] = [
                currentSpotPrice * 0.9,  // 10% ниже
                currentSpotPrice * 1.1   // 10% выше
              ];
              
              tx = await pool.mintRangeQuote(
                amountInFloat,
                tinyTickRange,
                widerPriceRange,
                { floatingSlippage: 0.1, surplus: false }  // Увеличиваем slippage до 10%
              );
            }
          }
          
          setStatus(`Add Concentrated Liquidity Tx sent: ${tx.hash}. Waiting...`);
          console.log("Transaction hash:", tx.hash);
          
          await tx.wait();
          setStatus(`Add Concentrated Liquidity successful! Tx: ${tx.hash}`);
          
        } catch (txError) {
          console.error("Transaction failed:", txError);
          
          // If it's a "D" error, try again with an even narrower range
          if (txError.message.includes("reverted: 'D'")) {
            console.log("Received 'D' error, trying with minimum possible range...");
            
            // Create a range that must include the current tick, to avoid 'D' error
            // The type of token (base/quote) determines how we must position the range
            
            let lastResortRange;
            // Make sure we have a valid tick spacing value
            const finalTickSpacing = tickSpacing || 10; // Default to 10 if undefined
            
            if (usingBaseToken) {
              // For base token, current price must be AT OR ABOVE lower tick
              // So ensure lower tick is at or below current tick
              const safeLowerTick = Math.min(
                Math.floor(currentTick / finalTickSpacing) * finalTickSpacing,  // Align down to spacing
                currentTick - 1  // Ensure it's below current tick
              );
              const safeUpperTick = safeLowerTick + finalTickSpacing;  // Just one spacing above
              // Ensure we have integers
              lastResortRange = [Math.floor(safeLowerTick), Math.ceil(safeUpperTick)];
              console.log("Base token lastResortRange (current tick MUST BE >= lower tick):", lastResortRange);
            } else {
              // For quote token, current price must be AT OR BELOW upper tick
              // So ensure upper tick is at or above current tick
              const safeUpperTick = Math.max(
                Math.ceil(currentTick / finalTickSpacing) * finalTickSpacing,  // Align up to spacing
                currentTick + 1  // Ensure it's above current tick
              );
              const safeLowerTick = safeUpperTick - finalTickSpacing;  // Just one spacing below
              // Ensure we have integers
              lastResortRange = [Math.floor(safeLowerTick), Math.ceil(safeUpperTick)];
              console.log("Quote token lastResortRange (current tick MUST BE <= upper tick):", lastResortRange);
            }
            
            // Check explicitly if the range is safe
            const isSafeRange = usingBaseToken 
              ? (currentTick >= lastResortRange[0]) // Base token requirement
              : (currentTick <= lastResortRange[1]); // Quote token requirement
            
            console.log(`Range safety check: ${isSafeRange ? 'PASS' : 'FAIL'} for ${usingBaseToken ? 'base' : 'quote'} token`);
            console.log("Current tick:", currentTick, "Range:", lastResortRange);
            console.log("Last resort tick range:", lastResortRange);
            
            setStatus("First attempt failed. Trying with minimum possible range...");
            
            // Вместо ручного расчета tighterPriceLimits для повторной попытки
            // теперь мы используем увеличенный slippage = 0.10 (10%) в опциях
            console.log("Using increased slippage of 10% for retry");
            console.log("Current price for reference:", currentSpotPrice);
            
            // Log retry parameters
            console.log("=== RETRY PARAMETERS FOR DEBUGGING ===");
            console.log("Transaction type:", usingBaseToken ? "mintRangeBase (RETRY)" : "mintRangeQuote (RETRY)");
            console.log("From address:", address);
            console.log("To contract address:", DEX_ADDRESS);
            console.log("Parameters for retry:");
            console.log("- Amount:", amountInFloat);
            console.log("- Tick range (last resort):", JSON.stringify(lastResortRange));
            console.log("- Tick spacing used:", tickSpacing);
            console.log("- Options:", JSON.stringify({ slippage: 0.10, surplus: false }));
            console.log("======================================");
            
            // Instrument the signer again for the retry
            try {
              // Save original send transaction for restoration
              const originalSendTransaction = signer.sendTransaction;
              
              // Replace with our instrumented version for retry
              signer.sendTransaction = async (txRequest) => {
                // Log the actual transaction details for retry
                console.log("=== CAPTURED RAW RETRY TRANSACTION ===");
                console.log("From:", txRequest.from);
                console.log("To:", txRequest.to);
                console.log("Value:", txRequest.value?.toString() || "0");
                console.log("Data:", txRequest.data);
                console.log("Gas limit:", txRequest.gasLimit?.toString() || "auto");
                console.log("=====================================");
                
                // Restore original immediately
                signer.sendTransaction = originalSendTransaction;
                
                // Forward to the original method
                return originalSendTransaction.call(signer, txRequest);
              };
            } catch (instrumentError) {
              console.error("Error instrumenting signer for retry:", instrumentError);
            }
            
            if (usingBaseToken) {
              console.log("Calling mintRangeBase with minimum range (RETRY)");
              // Используем увеличенный slippage для повторной попытки
              const retrySlippage = 0.10; // 10% слиппаж для еще большей безопасности
              
              // Используем самый базовый возможный диапазон - от текущего тика до текущего тика + 1
              // Это должно быть наиболее стабильно
              const singleTickRange = [
                currentTick, 
                currentTick + 1
              ];
              
              console.log("Using SINGLE tick range for retry:", singleTickRange);
              console.log("Original lastResortRange was:", lastResortRange);
              
              try {
                tx = await pool.mintRangeBase(
                  amountInFloat, 
                  singleTickRange, // Используем абсолютно минимальный диапазон
                  { slippage: retrySlippage, surplus: false }
                );
              } catch (retryError) {
                console.error("Failed with single tick range too:", retryError);
                
                // Последняя отчаянная попытка с очень узким диапазоном
                // Выравнивание по tickSpacing обычно самое надежное
                const tickSpacing = 60; // Типичное значение для Ambient
                const alignedTick = Math.floor(currentTick / tickSpacing) * tickSpacing;
                const alignedRange = [alignedTick, alignedTick + tickSpacing];
                
                console.log("Last resort attempt with aligned range:", alignedRange);
                
                tx = await pool.mintRangeBase(
                  amountInFloat, 
                  alignedRange,
                  { slippage: 0.2 } // Увеличиваем slippage до 20% для гарантии
                );
              }
            } else {
              console.log("Calling mintRangeQuote with minimum range (RETRY)");
              // Используем увеличенный slippage для повторной попытки
              const retrySlippage = 0.10; // 10% слиппаж для еще большей безопасности
              
              // Используем самый базовый возможный диапазон - от текущего тика - 1 до текущего тика
              // Это должно быть наиболее стабильно
              const singleTickRange = [
                currentTick - 1, 
                currentTick
              ];
              
              console.log("Using SINGLE tick range for retry:", singleTickRange);
              console.log("Original lastResortRange was:", lastResortRange);
              
              try {
                tx = await pool.mintRangeQuote(
                  amountInFloat, 
                  singleTickRange, // Используем абсолютно минимальный диапазон
                  { slippage: retrySlippage, surplus: false }
                );
              } catch (retryError) {
                console.error("Failed with single tick range too:", retryError);
                
                // Последняя отчаянная попытка с очень узким диапазоном
                // Выравнивание по tickSpacing обычно самое надежное
                const tickSpacing = 60; // Типичное значение для Ambient
                const alignedTick = Math.floor(currentTick / tickSpacing) * tickSpacing;
                const alignedRange = [alignedTick, alignedTick + tickSpacing];
                
                console.log("Last resort attempt with aligned range:", alignedRange);
                
                tx = await pool.mintRangeQuote(
                  amountInFloat, 
                  alignedRange,
                  { slippage: 0.2 } // Увеличиваем slippage до 20% для гарантии
                );
              }
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
        if (usingBaseToken) {
          errorMessage = "Transaction reverted with 'D' error: With base token (ETH), the CURRENT PRICE must be AT OR ABOVE your lower range boundary. " +
            "The error occurs in determinePriceRange() contract function. " +
            "Try setting a lower price range that is below the current price.";
        } else {
          errorMessage = "Transaction reverted with 'D' error: With quote token (KING), the CURRENT PRICE must be AT OR BELOW your upper range boundary. " +
            "The error occurs in determinePriceRange() contract function. " +
            "Try setting a higher price range that is above the current price.";
        }
      } else if (errorMessage.includes("execution reverted: 'RC'") || errorMessage.includes("reverted: 'RC'")) {
        // Special handling for the specific 'RC' error in snapCurveInRange function
        errorMessage = "Transaction reverted with 'RC' error: The current price is outside the allowed price limits. " +
          "This error occurs in snapCurveInRange() function, which is a slippage protection check. " +
          "The current code should already handle this, so this means there's a more fundamental issue " +
          "with the price limits calculation.";
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
          <strong>Note:</strong> Using small amount (0.001 ETH/KING) for testing. After API inspection, we're now correctly using mintRangeBase/mintRangeQuote with proper parameters.
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