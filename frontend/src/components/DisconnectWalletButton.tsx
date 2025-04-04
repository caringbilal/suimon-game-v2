import React from 'react';
import { useDisconnectWallet } from '@mysten/dapp-kit';
import { socketService } from '../services/socketService';
import './DisconnectWalletButton.css';

interface DisconnectWalletButtonProps {
  className?: string;
}

const DisconnectWalletButton: React.FC<DisconnectWalletButtonProps> = ({ className }) => {
  const { mutate: disconnect } = useDisconnectWallet();

  const handleDisconnect = () => {
    disconnect();
    socketService.emitWalletEvent('walletDisconnected', {
      timestamp: new Date().toISOString(),
      userAction: 'manual_disconnect'
    });
  };

  return (
    <button 
      className={`disconnect-wallet-button ${className || ''}`} 
      onClick={handleDisconnect}
    >
      Disconnect Wallet
    </button>
  );
};

export default DisconnectWalletButton;