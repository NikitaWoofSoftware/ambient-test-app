import { useState, useEffect } from 'react';
import { type WalletClient, useWalletClient } from 'wagmi';
// Импортируем основной класс CrocEnv из SDK
import { CrocEnv } from '@crocswap-libs/sdk';
import { BrowserProvider, JsonRpcSigner } from 'ethers';

// Convert Viem WalletClient to Ethers v6 Signer
export async function walletClientToSigner(walletClient: WalletClient): Promise<JsonRpcSigner> {
  const { account, chain, transport } = walletClient;
  const provider = new BrowserProvider(transport, chain?.id);
  return provider.getSigner(account.address);
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
  const { data: walletClient } = useWalletClient();
  const [sdkState, setSdkState] = useState<SdkState>(initialState);

  useEffect(() => {
    // Сбрасываем состояние, если кошелек отключен
    if (!walletClient) {
      setSdkState({ 
        ...initialState, 
        error: "Wallet not connected" 
      });
      return;
    }

    const initSdk = async () => {
      setSdkState(prev => ({ ...prev, isLoading: true, error: null })); // Начинаем загрузку
      try {
        // Проверка аккаунта
        if (!walletClient.account || !walletClient.account.address) {
          throw new Error("Invalid account: no account address available");
        }

        // Проверка сети
        if (!walletClient.chain || walletClient.chain.id !== 1923) {
          throw new Error(`Connected to wrong chain: ${walletClient.chain?.id || 'unknown'} (should be 1923 Swell Chain)`);
        }

        // Получаем signer из walletClient
        const signer = await walletClientToSigner(walletClient).catch(err => {
          console.error("Failed to get signer:", err);
          throw new Error("Failed to initialize signer: " + err.message);
        });
        
        // Создаем экземпляр CrocEnv с указанием сети "swell" и signer'а
        try {
          console.log('Creating CrocEnv instance with signer:', signer);
          
          // Создаем экземпляр CrocEnv
          // Первый параметр - сеть, второй - signer
          const croc = new CrocEnv("swell", signer);
          console.log('Successfully created CrocEnv instance:', croc);
          
          if (croc) {
            console.log("Successfully created SDK instance:", croc);
            setSdkState({ 
              croc, 
              signer, 
              ready: true, 
              error: null, 
              isLoading: false 
            });
          } else {
            throw new Error('Failed to create SDK instance through any available method');
          }
        } catch (error) {
          console.error("Failed to initialize SDK:", error);
          throw error; // Пробросим ошибку для обработки выше
        }
      } catch (error: any) {
        const errorMsg = error?.message || "Unknown error";
        console.error("Failed to initialize Ambient SDK:", errorMsg);
        setSdkState({ 
          croc: null, 
          signer: null, 
          ready: false, 
          error: errorMsg, 
          isLoading: false 
        });
      }
    };

    // Запускаем инициализацию SDK при изменении walletClient
    initSdk();
  }, [walletClient]);

  return sdkState;
}