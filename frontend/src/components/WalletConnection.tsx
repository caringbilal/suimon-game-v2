import React, { useEffect, useState } from 'react';
import { ConnectButton, useCurrentWallet, useWallets } from '@mysten/dapp-kit';
import { useSuiWallet } from '../context/SuiWalletContext';
import './WalletConnection.css';

const WalletConnection: React.FC = () => {
  const { walletAddress, suiBalance, suimonBalance, isConnected, isLoading, error } = useSuiWallet();
  const { isConnecting, isConnected: dappKitConnected } = useCurrentWallet();
  const wallets = useWallets(); // Use dapp-kit's wallet detection
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [noWalletDetected, setNoWalletDetected] = useState<boolean>(false);

  // Log initial state on mount
  useEffect(() => {
    console.log('WalletConnection component mounted');
    console.log('Initial wallet state:', { isConnected, walletAddress, isLoading, error, dappKitConnected });
  }, []);

  // Detect wallet availability using dapp-kit
  useEffect(() => {
    console.log('Wallet connection state changed:', { isConnected, dappKitConnected, walletAddress });

    // Check if any wallets are available
    if (wallets.length === 0) {
      setNoWalletDetected(true);
      setConnectionError('No Sui-compatible wallet detected. Please install a wallet like Sui Wallet.');
    } else {
      setNoWalletDetected(false);
    }

    // Log state mismatch for debugging
    if (dappKitConnected !== isConnected) {
      console.warn('Connection state mismatch between dapp-kit and SuiWalletContext:', {
        dappKitConnected,
        isConnected,
      });
    }
  }, [isConnected, dappKitConnected, walletAddress, wallets]);

  // Format balance for display
  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.0001) return '< 0.0001';
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  // Custom ConnectButton component
  const CustomConnectButton = () => {
    return (
      <div className="connect-button-container">
        <ConnectButton
          className="custom-connect-button"
          connectText={
            noWalletDetected
              ? 'NO WALLET DETECTED'
              : isConnecting
              ? 'CONNECTING...'
              : dappKitConnected
              ? 'CONNECTED'
              : 'CONNECT WALLET'
          }
          onClick={() => {
            console.log('Connect wallet button clicked');
            setConnectionError(null); // Clear previous errors on click
          }}
        />
        {connectionError && <div className="connection-error">{connectionError}</div>}
      </div>
    );
  };

  return (
    <div className="wallet-connection">
      <div className="wallet-status">
        {dappKitConnected ? (
          <div className="wallet-info">
            <div className="wallet-status-connected">Wallet is Connected</div>
            <div className="wallet-address">
              {walletAddress
                ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                : 'Address not available'}
            </div>
            <div className="balance-container">
              <div className="balance-item">
                <span className="balance-label">SUI:</span>
                <span className="balance-value">
                  {isLoading ? 'Loading...' : formatBalance(suiBalance)}
                </span>
              </div>
              <div className="balance-item">
                <span className="balance-label">SUIMON:</span>
                <span className="balance-value">
                  {isLoading ? 'Loading...' : formatBalance(suimonBalance)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="connect-prompt">
            {noWalletDetected
              ? 'Please install a Sui-compatible wallet to continue.'
              : 'Connect your wallet to play with tokens'}
          </div>
        )}
      </div>
      <div className="connect-button-wrapper">
        <CustomConnectButton />
      </div>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default WalletConnection;