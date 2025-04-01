import './App.css'
import { ConnectWallet } from './components/ConnectWallet'
import { AmbientInteraction } from './components/AmbientInteraction'

function App() {
  return (
    <div className="app-container">
      <div className="header">
        <h1>Ambient DEX on Swell Chain</h1>
        <p>A simple interface to test Ambient on Swell Chain only</p>
        <div style={{ backgroundColor: '#f0f8ff', padding: '10px', borderRadius: '4px', marginTop: '10px' }}>
          <strong>Note:</strong> This app works exclusively with Swell Chain (ID: 1923)
        </div>
        <div style={{ 
          backgroundColor: '#fff8e6', 
          padding: '15px', 
          borderRadius: '4px', 
          marginTop: '15px', 
          fontSize: '0.9rem',
          border: '1px solid #ffd54f',
          color: '#5d4037',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          <strong style={{ fontSize: '1rem', display: 'block', marginBottom: '8px' }}>⚠️ Troubleshooting:</strong> 
          <p style={{ margin: '0 0 8px 0' }}>If you encounter connection issues, try adding Swell Chain to your wallet manually with these details:</p>
          <div style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.7)', 
            padding: '10px', 
            borderRadius: '4px',
            marginTop: '8px'
          }}>
            <ul style={{ margin: '0', paddingLeft: '20px' }}>
              <li><strong>Network Name:</strong> Swell Chain</li>
              <li><strong>Chain ID:</strong> 1923</li>
              <li><strong>RPC URL:</strong> https://swell-mainnet.alt.technology</li>
              <li><strong>Symbol:</strong> ETH</li>
              <li><strong>Block Explorer:</strong> https://swellexplorer.xyz</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div className="wallet-section" style={{ display: 'flex', justifyContent: 'center', marginBottom: '25px' }}>
        <ConnectWallet />
      </div>
      
      <AmbientInteraction />
    </div>
  )
}

export default App
