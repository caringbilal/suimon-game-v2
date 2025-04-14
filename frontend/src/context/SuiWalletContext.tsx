import React, { createContext, useContext, useState, useEffect } from 'react';
import { useCurrentWallet, useSuiClient } from '@mysten/dapp-kit';
import { socketService } from '../services/socketService';
import { getSuimonBalance, SUIMON_COIN_TYPE } from '../utils/suimonTokenUtils';

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

// SUIMON coin type is imported from suimonTokenUtils

export const SuiWalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentWallet, isConnected: dappKitConnected } = useCurrentWallet();
  const suiClient = useSuiClient();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [suiBalance, setSuiBalance] = useState<string>('0');
  const [suimonBalance, setSuimonBalance] = useState<string>('0');
  const [isLoading, setIsLoading] = useState<boolean>(false);
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
        wallet: currentWallet?.name ?? 'unknown',
        timestamp: new Date().toISOString(),
        connectionType: currentWallet?.name ?? 'unknown',
        accountDetails: currentWallet?.accounts ?? [],
        network: 'unknown',
        chainId: (currentWallet as any)?.chainId ?? 'unknown',
      });
      
    } else {
      setWalletAddress(null);
      setSuiBalance('0');
      setSuimonBalance('0');
      socketService.emitWalletEvent('walletDisconnected', {
        timestamp: new Date().toISOString(),
        userAction: 'wallet_disconnected'
      });
    }
  }, [dappKitConnected, currentWallet]);

  const updateBalances = async () => {
    if (!walletAddress || !suiClient) {
      console.error('SUI Client or wallet address not initialized');
      setError('Wallet client or address not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get SUI balance
      if (!suiClient.getCoins) {
        throw new Error('SUI Client methods not available');
      }
      const coins = await suiClient.getCoins({
        owner: walletAddress,
        coinType: '0x2::sui::SUI'
      });
      const coinsData = coins?.data;
      const totalBalance = coinsData && Array.isArray(coinsData) && coinsData.length > 0
        ? coinsData.reduce((acc: bigint, coin: {balance: string}) => acc + BigInt(coin.balance), BigInt(0))
        : BigInt(0);
      setSuiBalance(totalBalance.toString());

      // Get SUIMON balance
      const suimonCoins = await suiClient.getCoins({
        owner: walletAddress,
        coinType: SUIMON_COIN_TYPE
      });
      const suimonCoinsData = suimonCoins?.data;
      const totalSuimonBalance = suimonCoinsData && Array.isArray(suimonCoinsData) && suimonCoinsData.length > 0
        ? suimonCoinsData.reduce((acc: bigint, coin: {balance: string}) => acc + BigInt(coin.balance), BigInt(0))
        : BigInt(0);
      // Format SUIMON balance with 9 decimal places
      const formattedSuimonBalance = (Number(totalSuimonBalance) / 1_000_000_000).toString();
      setSuimonBalance(formattedSuimonBalance);

    } catch (error) {
      console.error('Error updating balances:', error);
      setError('Failed to update balances');
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