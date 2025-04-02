/*****************************
 * FILE: src/main.tsx
 *****************************/

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit' // Import theme
import '@rainbow-me/rainbowkit/styles.css'

import './index.css' // Base styles
import App from './App.tsx'
import { config } from './wagmi'
import { swell } from './chains' // Import swell chain config

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {/* Configure RainbowKit */}
        <RainbowKitProvider
          chains={[swell]} // Explicitly pass chains here too
          initialChain={swell} // Set initial chain to Swell
          showRecentTransactions={true}
          modalSize="compact" // Example: use compact modal
          theme={lightTheme({ // Use light theme explicitly
             accentColor: '#646cff', // Match primary color
             accentColorForeground: 'white',
             borderRadius: 'medium',
          })}
        >
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)

