import React from 'react';
import { ConnectButton } from '@mysten/dapp-kit';
import { useSuiWallet } from '../context/SuiWalletContext';
import './WalletConnection.css';

const WalletConnection: React.FC = () => {
  const { walletAddress, suiBalance, suimonBalance, isConnected, isLoading, error } = useSuiWallet();

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.0001) return '< 0.0001';
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  return (
    <div className="wallet-connection">
      <div className="wallet-status">
        {isConnected ? (
          <div className="wallet-info">
            <div className="wallet-address">
              {`${walletAddress?.slice(0, 6)}...${walletAddress?.slice(-4)}`}
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
      <ConnectButton />
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default WalletConnection;