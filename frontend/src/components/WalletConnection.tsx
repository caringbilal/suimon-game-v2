import React, { useEffect, useState } from 'react';
import { ConnectButton, useCurrentWallet, useWallets } from '@mysten/dapp-kit';
import { useSuiWallet } from '../context/SuiWalletContext';
import { socketService } from '../services/socketService';
import './WalletConnection.css';

const WalletConnection: React.FC = () => {
  const { walletAddress, suiBalance, suimonBalance, isConnected, isLoading, error, updateBalances } = useSuiWallet();
  const { isConnecting, isConnected: dappKitConnected } = useCurrentWallet();
  const wallets = useWallets();
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [noWalletDetected, setNoWalletDetected] = useState<boolean>(false);

  useEffect(() => {
    socketService.emitWalletEvent('componentMount', { 
      isConnected, 
      walletAddress, 
      isLoading, 
      error, 
      dappKitConnected,
      availableWallets: wallets.map(w => w.name)
    });

    // Add global click listener for debugging
    const handleGlobalClick = (event: MouseEvent) => {
      console.log('Global click detected on element:', event.target);
    };
    document.addEventListener('click', handleGlobalClick);

    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  useEffect(() => {
    if (wallets.length === 0) {
      setNoWalletDetected(true);
      setConnectionError('No Sui-compatible wallet detected. Please install a wallet like Sui Wallet or Suiet.');
      socketService.emitWalletEvent('noWalletDetected', { timestamp: new Date().toISOString() });
    } else {
      setNoWalletDetected(false);
      socketService.emitWalletEvent('walletsDetected', { wallets: wallets.map(wallet => wallet.name) });
    }

    if (dappKitConnected !== isConnected) {
      socketService.emitWalletEvent('connectionStateMismatch', {
        dappKitConnected,
        isConnected,
      });
    }

    socketService.emitWalletEvent('connectionStateChange', { 
      isConnected, 
      dappKitConnected, 
      walletAddress 
    });
  }, [isConnected, dappKitConnected, walletAddress, wallets]);

  useEffect(() => {
    if (isConnecting) {
      console.log('Wallet connection in progress...');
      socketService.emitWalletEvent('connecting', { timestamp: new Date().toISOString() });
    }
    if (dappKitConnected) {
      console.log('Wallet successfully connected via dapp-kit!');
      socketService.emitWalletEvent('connected', { timestamp: new Date().toISOString() });
      updateBalances(); // Fetch balances when connected
    }
  }, [isConnecting, dappKitConnected, updateBalances]);

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.0001) return '< 0.0001';
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  const CustomConnectButton = () => {
    return (
      <div
        className="connect-button-container"
        onClick={(event) => {
          console.log('Clicked connect-button-container', event.target);
          socketService.emitWalletEvent('connectButtonClicked', {
            timestamp: new Date().toISOString(),
            wallets: wallets.map(w => w.name),
            isConnecting,
            dappKitConnected,
          });
        }}
      >
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
        />
        {connectionError && <div className="connection-error">{connectionError}</div>}
      </div>
    );
  };

  return (
    <div
      className="wallet-connection"
      onClick={(event) => console.log('Clicked wallet-connection div', event.target)}
    >
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