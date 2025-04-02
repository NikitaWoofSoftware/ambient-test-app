/*****************************
 * FILE: src/App.tsx
 *****************************/

import './App.css'
import { ConnectWallet } from './components/ConnectWallet'
import { AmbientInteractionController } from './components/AmbientInteractionController' // Renamed Controller
import { SWEL_CHAIN_ID, SWEL_EXPLORER_URL, SWEL_RPC_URL } from './constants'; // Import constants

function App() {
  return (
    <div className="app-container">
      <div className="header">
        <h1>Ambient DEX on Swell Chain</h1>
        <p>A simple interface to test Ambient SDK on Swell Chain</p>
        {/* Swell Chain Note */}
        <div style={{ backgroundColor: '#f0f8ff', padding: '10px', borderRadius: '4px', marginTop: '10px', border: '1px solid #b3e5fc' }}>
          <strong>Note:</strong> This app interacts exclusively with Swell Chain (ID: {SWEL_CHAIN_ID}). Ensure your wallet is connected to this network.
        </div>
        {/* Troubleshooting Box */}
        <div style={{
          backgroundColor: '#fff8e6',
          padding: '15px',
          borderRadius: '4px',
          marginTop: '15px',
          fontSize: '0.9rem',
          border: '1px solid #ffd54f',
          color: '#5d4037',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          textAlign: 'left' // Align list left
        }}>
          <strong style={{ fontSize: '1rem', display: 'block', marginBottom: '8px' }}>⚠️ Troubleshooting Connection Issues:</strong>
          <p style={{ margin: '0 0 8px 0' }}>If you encounter problems, try adding Swell Chain manually:</p>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            padding: '10px',
            borderRadius: '4px',
            marginTop: '8px'
          }}>
            <ul style={{ margin: '0', paddingLeft: '20px', listStyle: 'disc' }}>
              <li><strong>Network Name:</strong> Swell Chain</li>
              <li><strong>Chain ID:</strong> {SWEL_CHAIN_ID}</li>
              <li><strong>RPC URL:</strong> {SWEL_RPC_URL}</li>
              <li><strong>Symbol:</strong> ETH</li>
              <li><strong>Block Explorer:</strong> {SWEL_EXPLORER_URL}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Center Connect Wallet Button */}
      <div className="wallet-section">
        <ConnectWallet />
      </div>

      {/* Ambient Interaction Area */}
      <AmbientInteractionController />

    </div>
  )
}

export default App
