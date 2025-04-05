import React, { useState } from 'react';
import {
    useSuiClient,
    useCurrentAccount,
    useSignAndExecuteTransaction,
} from '@mysten/dapp-kit';
// Ensure TransactionBlock is imported correctly
import { TransactionBlock } from '@mysten/sui.js/transactions';
// Keep the import for the response type, but we let TS infer the type for confirmedTx for now
import { SuiTransactionBlockResponse } from '@mysten/sui.js/client';
import { useSuiWallet } from '../context/SuiWalletContext';
import TransactionStatus, { TransactionStage } from './TransactionStatus';
import { socketService } from '../services/socketService';
import './GameOptions.css';

// Define a type alias for token types
type TokenType = 'SUI' | 'SUIMON';

// Define a minimal interface for the wallet account
interface CustomWalletAccount {
    address: string;
    publicKey?: Uint8Array | readonly number[];
    chains?: string[];
    features?: string[];
    label?: string;
    icon?: string;
    [key: string]: any;
}

interface GameOptionsProps {
    onCreateGame: (tokenType: TokenType, amount: string) => void;
}

// Define a type for the options arrays
interface OptionType {
    label: string;
    value: string;
}

const GameOptions: React.FC<GameOptionsProps> = ({ onCreateGame }) => {
    const { walletAddress, suiBalance, suimonBalance, isConnected } = useSuiWallet();
    const suiClient = useSuiClient();
    const currentAccount = useCurrentAccount() as CustomWalletAccount | null;
    const { mutateAsync: signAndExecuteTransactionAsync } = useSignAndExecuteTransaction();
    const [selectedToken, setSelectedToken] = useState<TokenType>('SUI');
    const [transactionStage, setTransactionStage] = useState<TransactionStage>('idle');
    const [transactionError, setTransactionError] = useState<string | undefined>();
    const [stakeAmount, setStakeAmount] = useState<string>('');
    const [transactionHash, setTransactionHash] = useState<string | undefined>();

    const suiOptions: OptionType[] = [
        { label: '0.0005 SUI', value: '0.0005' },
        { label: '0.005 SUI', value: '0.005' },
        { label: '0.05 SUI', value: '0.05' },
    ];

    const suimonOptions: OptionType[] = [
        { label: '1,000 SUIMON', value: '1000' },
        { label: '10,000 SUIMON', value: '10000' },
        { label: '100,000 SUIMON', value: '100000' },
    ];


    const formatBalance = (balance: string | null | undefined, tokenType: string = 'SUI') => {
        // ... (implementation remains the same)
        if (balance === null || balance === undefined) return '0';
        try {
            const num = tokenType === 'SUI' ? parseFloat(balance) / 1_000_000_000 : parseFloat(balance);
            if (isNaN(num)) return '0';
            if (num === 0) return '0';
            if (num < 0.0001 && num > 0) return '< 0.0001';

            if (num >= 1000) {
                return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
            } else if (num >= 1) {
                return num.toLocaleString(undefined, { maximumFractionDigits: 3 });
            } else {
                return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
            }
        } catch (error) {
            console.error("Error formatting balance:", error);
            return 'Error';
        }
    };

    const handleStakeButtonClick = async (tokenType: TokenType, value: string) => {
        // ... (initial checks for isConnected, walletAddress, currentAccount remain the same) ...
         if (!isConnected || !walletAddress || !currentAccount) {
            console.log('Wallet not connected or account not found.');
            setTransactionError('Please connect your wallet first.');
            setTransactionStage('error');
            return;
        }
        const ownerAddress = currentAccount.address || walletAddress;
        if (!ownerAddress) {
             console.log('Could not determine wallet owner address.');
             setTransactionError('Could not determine wallet address.');
             setTransactionStage('error');
            return;
        }

        setStakeAmount(value);
        setTransactionStage('preparing');
        setTransactionError(undefined);
        setTransactionHash(undefined);
        let currentTxDigest: string | undefined = undefined;

        try {
            // ... (console logs, socket emit) ...
            console.log('=== Starting Transaction Preparation ===');
             socketService.emitWalletEvent('transactionStarted', {
                tokenType, amount: value, playerAddress: ownerAddress,
                playerName: currentAccount?.label || 'Player', stage: 'preparing', action: 'stakeTransaction',
             });


            const tx = new TransactionBlock(); // Ensure tx is correctly initialized
            // ... (build the transaction block 'tx' with splits, merges, move calls) ...
            const amountInMinimalUnit = tokenType === 'SUI' ? BigInt(Math.floor(parseFloat(value) * 1_000_000_000)) : BigInt(parseInt(value, 10));
            const coinType = tokenType === 'SUI' ? '0x2::sui::SUI' : '0xc0ba93a810adb498900c82bb6f7c16ca3046dfa7b6f364ec985595fdeb1ee9ad::suimon::SUIMON';
            const coins = await suiClient.getCoins({ owner: ownerAddress, coinType: coinType });

            let paymentCoin;
             if (tokenType === 'SUI') {
                 const balanceBN = BigInt(suiBalance || '0');
                 if (balanceBN < amountInMinimalUnit) { throw new Error(`Insufficient SUI balance (${formatBalance(suiBalance, 'SUI')} SUI) for the required amount (${formatBalance(amountInMinimalUnit.toString(), 'SUI')} SUI) + gas.`); }
                 console.log('Splitting SUI from gas...');
                 paymentCoin = tx.splitCoins(tx.gas, [tx.pure(amountInMinimalUnit)]);
             } else {
                 const availableCoins = coins.data?.filter(c => BigInt(c.balance) > 0).map(c => tx.object(c.coinObjectId)) || [];
                 if (availableCoins.length === 0) { throw new Error(`No usable ${tokenType} coin objects found.`); }
                 let totalBalance = coins.data?.reduce((sum, coin) => sum + BigInt(coin.balance), BigInt(0)) || BigInt(0);
                 if (totalBalance < amountInMinimalUnit) { throw new Error(`Insufficient total ${tokenType} balance (${formatBalance(totalBalance.toString(), tokenType)}) for the required amount (${formatBalance(amountInMinimalUnit.toString(), tokenType)}).`); }
                 console.log(`Attempting to gather ${tokenType} coins...`);
                 const targetCoin = availableCoins[0];
                 if (availableCoins.length > 1) { tx.mergeCoins(targetCoin, availableCoins.slice(1)); }
                 paymentCoin = tx.splitCoins(targetCoin, [tx.pure(amountInMinimalUnit)]);
             }
            console.log('Prepared payment coin object.');

            tx.moveCall({
                target: `0xa4e6822e7212ab15edc1243ff1cf33bf45346b35c08acacf4c7bf5204fdc3353::game::create_game`,
                arguments: [paymentCoin, tx.pure(tokenType === 'SUIMON')],
            });
            console.log('Move Call Prepared. Transaction Block ready.');


            // ... (feature check remains the same) ...
             if (!currentAccount.features || !currentAccount.features.includes('sui:signAndExecuteTransactionBlock')) {
                throw new Error('Connected wallet does not support the required `signAndExecuteTransactionBlock` feature.');
            }

            setTransactionStage('signing');
            console.log('Attempting to sign and execute transaction... Wallet pop-up should appear.');

            // *** CORE: Call the mutation function ***
            // WORKAROUND: Use type assertion 'as any' to bypass the TS2322 error.
            const response = await signAndExecuteTransactionAsync({
                transaction: tx as any, // Assert type as 'any'
            });

            console.log('Transaction sign+execute successful (raw response):', response);

            if (!response || !response.digest) {
                 console.error("Invalid response received after signing:", response);
                throw new Error('Transaction signed, but no digest was returned. Please check wallet connection.');
            }
            currentTxDigest = response.digest;
            console.log('Transaction Digest:', currentTxDigest);

            setTransactionStage('executing');
            setTransactionHash(currentTxDigest);
            socketService.emitWalletEvent('transactionExecuting', { transactionHash: currentTxDigest, playerAddress: ownerAddress, tokenType, amount: value, stage: 'executing' });


            console.log('Waiting for transaction confirmation...');
            setTransactionStage('confirming');
            socketService.emitWalletEvent('transactionConfirming', { transactionHash: currentTxDigest, playerAddress: ownerAddress, stage: 'confirming' });


            // Let TS infer the type of confirmedTx for now to avoid the duplicate type error symptom
            const confirmedTx = await suiClient.waitForTransaction({
                digest: currentTxDigest,
                options: {
                    showEffects: true,
                    showEvents: true,
                },
            });

            console.log('Confirmed Transaction:', confirmedTx);

            // Check effects status more defensively
            if (confirmedTx?.effects?.status?.status !== 'success') {
                 const errorMsg = `Transaction failed on-chain with status: ${confirmedTx?.effects?.status?.error || 'Unknown error'}`;
                 console.error(errorMsg, confirmedTx?.effects);
                throw new Error(errorMsg);
            }

            console.log('Transaction confirmed successfully on-chain.');
            setTransactionStage('success');
            socketService.emitWalletEvent('transactionSuccess', { transactionHash: currentTxDigest, playerAddress: ownerAddress, action: 'stakeTransaction', stage: 'success' });


        } catch (error: any) {
            console.error(`🔴 Transaction process error during stage: ${transactionStage}`, error);
            console.error('Error Details:', {
                errorName: error.name,
                errorMessage: error.message,
                // stack: error.stack, // Stack can be very long, log if needed
                stage: transactionStage,
                digest: currentTxDigest,
            });

            let errorMessage = error.message || 'An unknown error occurred during the transaction.';

            // Restore proper error checking logic
            if (error.name === 'WalletNoAccountSelectedError') {
                 errorMessage = 'No account selected in wallet.';
            } else if (errorMessage.includes('rejected') || errorMessage.includes('cancelled') || errorMessage.includes('denied') || error.name === 'UserRejectedRequestError') {
                errorMessage = 'Transaction rejected or cancelled in wallet.';
            } else if (errorMessage.includes('Insufficient gas') || errorMessage.includes('GasBalanceTooLow') || errorMessage.includes('Cannot find gas coin')) {
                 errorMessage = 'Insufficient SUI balance for the transaction and/or gas fees.';
            } else if (errorMessage.includes('MoveAbort') || errorMessage.includes('ExecutionError')) {
                errorMessage = `Transaction failed during execution: ${error.message}`;
            } else if (errorMessage.includes('Coin balance insufficient')) {
                 errorMessage = `Insufficient ${tokenType} balance.`;
            } // Add more specific checks as needed

            setTransactionError(errorMessage);
            setTransactionStage('error'); // Ensure stage is set on error

            socketService.emitWalletEvent('transactionError', {
                 error: errorMessage, errorObject: JSON.stringify(error, Object.getOwnPropertyNames(error)),
                 errorType: error.name, stage: transactionStage, digest: currentTxDigest,
                 tokenType, amount: value, playerAddress: ownerAddress,
                 walletStatus: isConnected ? 'connected' : 'disconnected', timestamp: new Date().toISOString(),
                 additionalDetails: { suiBalance: suiBalance, suimonBalance: suimonBalance },
             });
        }
    };

    const handleFinalizeGameCreation = () => {
        // ... (finalize logic remains the same) ...
         console.log(`Finalizing game creation after success: ${stakeAmount} ${selectedToken}`);
        onCreateGame(selectedToken, stakeAmount);
        setTransactionStage('idle');
        setTransactionError(undefined);
        setTransactionHash(undefined);
        setStakeAmount('');
    };


    return (
        // ... (JSX structure remains the same) ...
         <div className="game-options">
             {/* ... Token Selector ... */}
              <div className="token-selector">
                 <button className={`token-button ${selectedToken === 'SUI' ? 'active' : ''}`} onClick={() => { setSelectedToken('SUI'); setStakeAmount(''); setTransactionError(undefined); setTransactionStage('idle'); }}>
                     SUI Token <span className="balance">{formatBalance(suiBalance, 'SUI')} SUI</span>
                 </button>
                 <button className={`token-button ${selectedToken === 'SUIMON' ? 'active' : ''}`} onClick={() => { setSelectedToken('SUIMON'); setStakeAmount(''); setTransactionError(undefined); setTransactionStage('idle'); }}>
                     SUIMON Token <span className="balance">{formatBalance(suimonBalance, 'SUIMON')} SUIMON</span>
                 </button>
             </div>

            {transactionStage === 'idle' ? (
                 <div className="stake-options">
                     <h3>Select Stake Amount</h3>
                     <div className="options-grid">
                         {(selectedToken === 'SUI' ? suiOptions : suimonOptions).map((option: OptionType) => (
                             <button key={option.value} className={`stake-button ${stakeAmount === option.value ? 'selected' : ''}`} onClick={() => setStakeAmount(option.value)} disabled={!isConnected}>
                                 {option.label}
                                 {selectedToken === 'SUI' && <span className="gas-fee">+ Gas Fee</span>}
                             </button>
                         ))}
                     </div>
                     {isConnected ? (
                         <button className="stake-now-button" onClick={() => handleStakeButtonClick(selectedToken, stakeAmount)} disabled={!stakeAmount || transactionStage !== 'idle'}>
                             {stakeAmount ? `Stake ${stakeAmount} ${selectedToken}` : 'Select Amount'}
                         </button>
                     ) : ( <div className="connect-wallet-prompt"> Connect wallet to stake </div> )}
                 </div>
            ) : (
                 <TransactionStatus stage={transactionStage} error={transactionError} onCreateGame={handleFinalizeGameCreation} tokenType={selectedToken} amount={stakeAmount} transactionHash={transactionHash} />
            )}
        </div>
    );
};

export default GameOptions;