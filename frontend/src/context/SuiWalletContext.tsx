import React, { createContext, useContext, useState, useEffect } from 'react';
import { useCurrentWallet, useSuiClient } from '@mysten/dapp-kit';
import { socketService } from '../services/socketService';

interface SuiWalletContextType {
  walletAddress: string | null;
  suiBalance: string;
  suimonBalance: string;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  updateBalances: () => Promise<void>;
}

const SuiWalletContext = createContext<SuiWalletContextType | null>(null);

// Use the correct SUIMON coin type (update this with the actual coin type if different)
const SUIMON_COIN_TYPE = '0xc0ba93a810adb498900c82bb6f7c16ca3046dfa7b6f364ec985595fdeb1ee9ad::suimon::SUIMON';

export const SuiWalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentWallet, isConnected: dappKitConnected } = useCurrentWallet();
  const suiClient = useSuiClient();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [suiBalance, setSuiBalance] = useState('0');
  const [suimonBalance, setSuimonBalance] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    const connectionState = { 
      dappKitConnected, 
      currentWallet,
      previousAddress: walletAddress,
      timestamp: new Date().toISOString(),
      connectionDuration: isConnected ? Date.now() - new Date().getTime() : 0
    };
    socketService.emitWalletEvent('connectionStateChanged', connectionState);
    
    setIsConnected(dappKitConnected);
    if (dappKitConnected && currentWallet) {
      const address = currentWallet.accounts[0]?.address;
      setWalletAddress(address || null);
      socketService.emitWalletEvent('walletConnected', { 
        address, 
        wallet: currentWallet.name,
        timestamp: new Date().toISOString(),
        connectionType: currentWallet.name,
        accountDetails: currentWallet.accounts
      });
    } else {
      setWalletAddress(null);
      setSuiBalance('0');
      setSuimonBalance('0');
      socketService.emitWalletEvent('walletDisconnected', {});
    }
  }, [dappKitConnected, currentWallet]);

  const updateBalances = async () => {
    if (!walletAddress || !suiClient) return;

    setIsLoading(true);
    setError(null);

    try {
      // Get SUI balance
      const suiBalanceResponse = await suiClient.getBalance({
        owner: walletAddress,
      });
      setSuiBalance(suiBalanceResponse.totalBalance.toString());
      socketService.emitWalletEvent('balanceUpdate', {
        type: 'SUI',
        balance: suiBalanceResponse.totalBalance.toString(),
        address: walletAddress,
        timestamp: new Date().toISOString()
      });

      // Get SUIMON token balance
      const suimonBalanceResponse = await suiClient.getBalance({
        owner: walletAddress,
        coinType: SUIMON_COIN_TYPE,
      });
      setSuimonBalance(suimonBalanceResponse.totalBalance.toString());
      socketService.emitWalletEvent('balanceUpdate', {
        type: 'SUIMON',
        balance: suimonBalanceResponse.totalBalance.toString(),
        address: walletAddress,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      const errorMessage = 'Failed to fetch balances';
      setError(errorMessage);
      socketService.emitWalletEvent('error', {
        type: 'BALANCE_FETCH_ERROR',
        message: errorMessage,
        error: err,
        walletAddress,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (walletAddress) {
      updateBalances();
    }
  }, [walletAddress]);

  return (
    <SuiWalletContext.Provider
      value={{
        walletAddress,
        suiBalance,
        suimonBalance,
        isConnected,
        isLoading,
        error,
        updateBalances,
      }}
    >
      {children}
    </SuiWalletContext.Provider>
  );
};

export const useSuiWallet = () => {
  const context = useContext(SuiWalletContext);
  if (!context) {
    throw new Error('useSuiWallet must be used within a SuiWalletProvider');
  }
  return context;
};