import React, { useEffect, useState } from 'react';
import { useSuiWallet } from '../context/SuiWalletContext';
import { socketService } from '../services/socketService';
import { useConnectWallet, useWallets } from '@mysten/dapp-kit';
import { Wallet } from '@mysten/wallet-standard';
import './WalletConnection.css';

const WalletConnection: React.FC = () => {
  const { walletAddress, suiBalance, suimonBalance, isConnected, isLoading, error, updateBalances } = useSuiWallet();
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    socketService.emitWalletEvent('componentMount', { 
      isConnected, 
      walletAddress, 
      isLoading, 
      error
    });
  }, [isConnected, walletAddress, isLoading, error]);

  useEffect(() => {
    if (isConnected) {
      updateBalances();
    }
  }, [isConnected, updateBalances]);

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.0001) return '< 0.0001';
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  const CustomConnectButton = () => {
    const [showWalletList, setShowWalletList] = useState(false);
    const { mutate: connect } = useConnectWallet();
    const availableWallets: Wallet[] = useWallets();
    const wallets = [
      { name: 'Sui Wallet', icon: '🔷' },
      { name: 'Phantom', icon: '👻' },
      { name: 'Cosmostation', icon: '🌌' },
      { name: 'Suiet', icon: '🌊' },
    ];

    console.log('Available Wallets:', availableWallets);

    const handleConnect = async (walletName: string) => {
      try {
        socketService.emitWalletEvent('walletConnectionAttempt', { 
          walletName,
          timestamp: new Date().toISOString(),
          previousConnectionState: isConnected,
          hasError: !!connectionError
        });
        
        const wallet = wallets.find(w => w.name === walletName);
        if (!wallet) {
          throw new Error('Wallet not found');
        }

        const isAvailable = availableWallets.some((w: Wallet) => w.name === wallet.name);
        if (!isAvailable) {
          throw new Error(`${walletName} is not installed`);
        }
        
        // Type assertion to match the expected type for connect
        const selectedWallet = availableWallets.find(w => w.name === wallet.name)! as any;
        await connect({ wallet: selectedWallet });
        
        setShowWalletList(false);
      } catch (err) {
        console.error('Failed to connect wallet:', err);
        setConnectionError(`Failed to connect: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setShowWalletList(false);
      }
    };

    return (
      <div className="connect-button-container">
        {!showWalletList ? (
          <button 
            className="connect-wallet-button" 
            onClick={() => {
              setShowWalletList(true);
              socketService.emitWalletEvent('walletSelectionOpened', {
                timestamp: new Date().toISOString(),
                currentWalletState: {
                  isConnected,
                  hasAddress: !!walletAddress,
                  hasSuiBalance: parseFloat(suiBalance) > 0,
                  hasSuimonBalance: parseFloat(suimonBalance) > 0
                }
              });
            }}
          >
            Connect Wallet
          </button>
        ) : (
          <div className="wallet-list-popup">
            <div className="wallet-list-header">
              <h3>Connect a Wallet</h3>
              <button 
                className="close-button" 
                onClick={() => {
                  setShowWalletList(false);
                  socketService.emitWalletEvent('walletSelectionClosed', {
                    timestamp: new Date().toISOString(),
                    userAction: 'manual_close',
                    timeOpen: Date.now() - new Date().getTime()
                  });
                }}
              >
                ×
              </button>
            </div>
            <div className="wallet-list">
              {wallets.map((wallet) => (
                <button
                  key={wallet.name}
                  className="wallet-option"
                  onClick={() => handleConnect(wallet.name)}
                >
                  <span className="wallet-icon">{wallet.icon}</span>
                  <span className="wallet-name">{wallet.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {connectionError && <div className="connection-error">{connectionError}</div>}
      </div>
    );
  };

  return (
    <div className="wallet-connection">
      <div className="wallet-status">
        {isConnected ? (
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
            Connect your wallet to play with tokens
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