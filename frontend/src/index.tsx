import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './context/AuthContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
// FIX: Use sub-path import for newer @mysten/sui.js versions
import { getFullnodeUrl } from '@mysten/sui.js/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuiWalletProvider } from './context/SuiWalletContext';

const queryClient = new QueryClient();
const networks = {
  testnet: { url: getFullnodeUrl('testnet'), name: 'Sui Testnet' },
  // Add other networks if needed
};

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="testnet">
        {/* Ensure WalletProvider wraps components needing wallet access */}
        <WalletProvider>
          <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || ''}>
            <AuthProvider>
              <SuiWalletProvider>
                <App />
              </SuiWalletProvider>
            </AuthProvider>
          </GoogleOAuthProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

reportWebVitals();