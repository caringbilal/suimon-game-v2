import React, { createContext, useContext } from 'react';

interface WalletContextType {
  isConnected: boolean;
  connect: () => void;
}

const WalletContext = createContext<WalletContextType>({
  isConnected: false,
  connect: () => {},
});

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const connect = () => {
    // Will implement actual wallet connection later
    console.log('Wallet connection will be implemented later');
  };

  return (
    <WalletContext.Provider value={{ isConnected: false, connect }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);