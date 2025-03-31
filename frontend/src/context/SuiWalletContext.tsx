import React, { createContext, useContext, useState, useEffect } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { SuiClient } from '@mysten/sui/client';

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

const SUIMON_TOKEN_ADDRESS = '0xc0ba93a810adb498900c82bb6f7c16ca3046dfa7b6f364ec985595fdeb1ee9ad::suimon::SUIMON';
const TESTNET_RPC_URL = 'https://fullnode.testnet.sui.io:443';

export const SuiWalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const currentAccount = useCurrentAccount();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [suiBalance, setSuiBalance] = useState('0');
  const [suimonBalance, setSuimonBalance] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suiClient = new SuiClient({ url: TESTNET_RPC_URL });

  const updateBalances = async () => {
    if (!currentAccount?.address) return;

    setIsLoading(true);
    setError(null);

    try {
      // Get SUI balance
      const { totalBalance } = await suiClient.getBalance({
        owner: currentAccount.address,
      });
      setSuiBalance(totalBalance.toString());

      // Get SUIMON token balance
      const { totalBalance: tokenBalance } = await suiClient.getBalance({
        owner: currentAccount.address,
        coinType: SUIMON_TOKEN_ADDRESS,
      });
      setSuimonBalance(tokenBalance.toString());
    } catch (err) {
      setError('Failed to fetch balances');
      console.error('Error fetching balances:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentAccount?.address) {
      setWalletAddress(currentAccount.address);
      updateBalances();
    } else {
      setWalletAddress(null);
      setSuiBalance('0');
      setSuimonBalance('0');
    }
  }, [currentAccount]);

  return (
    <SuiWalletContext.Provider
      value={{
        walletAddress,
        suiBalance,
        suimonBalance,
        isConnected: !!currentAccount,
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