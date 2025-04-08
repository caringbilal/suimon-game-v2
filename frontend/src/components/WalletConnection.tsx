import React, { useEffect, useState } from 'react';
import { useSuiWallet } from '../context/SuiWalletContext';
import { socketService } from '../services/socketService';
import { useConnectWallet, useWallets, useCurrentWallet, useDisconnectWallet } from '@mysten/dapp-kit';
import { Wallet } from '@mysten/wallet-standard';
import './WalletConnection.css';
import './WalletDialog.css';

// Import wallet logos
import SuiLogo from '../assets/ui/Sui_Logo 128px.png';
import PhantomLogo from '../assets/ui/Phantom_Logo 128px.png';
import SuietLogo from '../assets/ui/Suiet_Logo 128px.png';

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
    console.log('Component Mount - isConnected:', isConnected); // Debug log
  }, [isConnected, walletAddress, isLoading, error]);

  useEffect(() => {
    if (isConnected) {
      updateBalances();
    }
  }, [isConnected, updateBalances]);

  // Removed formatBalance function as it's no longer needed for displaying balances in the top section

  const CustomConnectButton = () => {
    const [showWalletList, setShowWalletList] = useState(false);
    const { mutate: connect } = useConnectWallet();
    const { currentWallet } = useCurrentWallet();
    const { mutate: disconnect } = useDisconnectWallet();
    const availableWallets: Wallet[] = useWallets();
    const wallets = [
      { name: 'Sui Wallet', icon: SuiLogo },
      { name: 'Phantom', icon: PhantomLogo },
      { name: 'Suiet', icon: SuietLogo },
    ];

    console.log('Available Wallets:', availableWallets);
    console.log('CustomConnectButton - isConnected:', isConnected); // Debug log

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
        console.log('After Connect - isConnected:', isConnected); // Debug log
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
          <div className="wallet-popup-overlay">
            <div className="wallet-list-popup">
              <div className="wallet-list-header">
                <h3>Connect a Wallet</h3>
                <button 
                  className="wallet-close-icon"
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
                    data-wallet={wallet.name}
                    onClick={() => handleConnect(wallet.name)}
                  >
                    <span className="wallet-icon">
                      <img 
                        src={wallet.icon} 
                        alt={`${wallet.name} logo`} 
                        width="28" 
                        height="28" 
                        style={{ display: 'block' }}
                      />
                    </span>
                    <span className="wallet-name">{wallet.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {connectionError && <div className="connection-error">{connectionError}</div>}
        {isConnected ? (
          <button 
            className="disconnect-button" 
            onClick={() => {
              disconnect();
              socketService.emitWalletEvent('walletDisconnected', {
                timestamp: new Date().toISOString(),
                userAction: 'manual_disconnect'
              });
            }}
          >
            Disconnect Wallet
          </button>
        ) : null}
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
            {/* Balance information is hidden as it's already shown in the paid game area */}
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