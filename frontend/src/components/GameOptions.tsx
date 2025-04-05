import React, { useState } from 'react';
import {
    useSuiClient,
    useCurrentAccount,
    useSignAndExecuteTransaction,
    // Import specific types needed if inference fails later, but start without
} from '@mysten/dapp-kit';
// Use sub-path imports and TransactionBlock for newer sui.js versions
import { TransactionBlock } from '@mysten/sui.js/transactions';
// Keep import for reference, but don't use the type hint for confirmedTx for now
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
    features?: Record<string, any>; // Make features more flexible for logging
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
    const { mutateAsync: signAndExecuteTransactionAsync, isPending } = useSignAndExecuteTransaction();
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
        // ... (implementation remains the same) ...
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
        console.log('[handleStakeButtonClick] Initiated.'); // LOG 1
        // ... (Initial checks: isConnected, currentAccount, ownerAddress) ...
        if (!isConnected || !currentAccount || !currentAccount.address) {
            console.error('[handleStakeButtonClick] Pre-checks failed (Wallet/Account).');
            setTransactionError('Wallet not connected or account invalid.');
            setTransactionStage('error');
            return;
        }
        const ownerAddress = currentAccount.address;

        setStakeAmount(value);
        setTransactionStage('preparing');
        setTransactionError(undefined);
        setTransactionHash(undefined);
        let currentTxDigest: string | undefined = undefined;
        // Initialize tx definitely here
        const tx = new TransactionBlock();
        console.log('[handleStakeButtonClick] TransactionBlock initialized.'); // LOG 5 (Moved earlier)

        try {
            console.log(`[handleStakeButtonClick] Owner Address: ${ownerAddress}`); // LOG 2
            console.log(`[handleStakeButtonClick] Staking: ${value} ${tokenType}`); // LOG 3
            console.log('[handleStakeButtonClick] Emitting transactionStarted event.'); // LOG 4
             socketService.emitWalletEvent('transactionStarted', { /* ... payload ... */ });

            console.log('[handleStakeButtonClick] Building Transaction Block...');

            const amountInMinimalUnit = tokenType === 'SUI' ? BigInt(Math.floor(parseFloat(value) * 1_000_000_000)) : BigInt(parseInt(value, 10));
            const coinType = tokenType === 'SUI' ? '0x2::sui::SUI' : '0xc0ba93a810adb498900c82bb6f7c16ca3046dfa7b6f364ec985595fdeb1ee9ad::suimon::SUIMON';
            console.log(`[handleStakeButtonClick] Amount: ${amountInMinimalUnit.toString()}, CoinType: ${coinType}`); // LOG 6

            console.log('[handleStakeButtonClick] Fetching coins...'); // LOG 7
            const coins = await suiClient.getCoins({ owner: ownerAddress, coinType: coinType });
            console.log(`[handleStakeButtonClick] Coins found for ${coinType}:`, coins.data); // LOG 8

            let paymentCoin;
             if (tokenType === 'SUI') {
                // ... (SUI splitting logic using tx.gas, tx.pure) ...
                const balanceBN = BigInt(suiBalance || '0');
                console.log(`[handleStakeButtonClick] SUI Balance: ${balanceBN}, Needed: ${amountInMinimalUnit}`); // LOG 9
                if (balanceBN < amountInMinimalUnit) { throw new Error(`Insufficient SUI balance`); }
                console.log('[handleStakeButtonClick] Splitting SUI from gas...'); // LOG 10
                paymentCoin = tx.splitCoins(tx.gas, [tx.pure(amountInMinimalUnit)]);
             } else {
                 const availableCoins = coins.data?.filter(c => BigInt(c.balance) > 0) || [];
                 console.log(`[handleStakeButtonClick] Found ${availableCoins.length} usable ${tokenType} coin objects.`); // LOG 11
                 if (availableCoins.length === 0) { throw new Error(`No usable ${tokenType} coin objects found.`); }
                 let totalBalance = availableCoins.reduce((sum, coin) => sum + BigInt(coin.balance), BigInt(0));
                 console.log(`[handleStakeButtonClick] ${tokenType} Total Balance: ${totalBalance}, Needed: ${amountInMinimalUnit}`); // LOG 12
                 if (totalBalance < amountInMinimalUnit) { throw new Error(`Insufficient total ${tokenType} balance.`); }

                 const targetCoinInput = tx.object(availableCoins[0].coinObjectId);
                 if (availableCoins.length > 1) {
                    console.log('[handleStakeButtonClick] Merging SUIMON coins...'); // LOG 13
                    const coinsToMerge = availableCoins.slice(1).map(c => tx.object(c.coinObjectId));
                    tx.mergeCoins(targetCoinInput, coinsToMerge);
                 }
                 console.log('[handleStakeButtonClick] Splitting SUIMON coin...'); // LOG 14
                 paymentCoin = tx.splitCoins(targetCoinInput, [tx.pure(amountInMinimalUnit)]);
             }
            console.log('[handleStakeButtonClick] Prepared payment coin.'); // LOG 15

            tx.moveCall({
                target: `0xa4e6822e7212ab15edc1243ff1cf33bf45346b35c08acacf4c7bf5204fdc3353::game::create_game`,
                arguments: [paymentCoin, tx.pure(tokenType === 'SUIMON')],
            });
            console.log('[handleStakeButtonClick] Move Call added.'); // LOG 16
            console.log('[handleStakeButtonClick] Transaction Block Built (inspect blockData):', JSON.stringify(tx.blockData, null, 2)); // LOG 17

            console.log('[handleStakeButtonClick] Checking Account Features...'); // LOG 18
            console.log('[handleStakeButtonClick] currentAccount:', JSON.stringify(currentAccount, null, 2)); // LOG 19
            const signExecuteFeature = currentAccount.features?.['sui:signAndExecuteTransactionBlock'];
            console.log('[handleStakeButtonClick] sui:signAndExecuteTransactionBlock Feature:', signExecuteFeature); // LOG 20

             if (!signExecuteFeature) {
                console.error('[handleStakeButtonClick] Wallet does not support sui:signAndExecuteTransactionBlock feature.');
                throw new Error('Connected wallet does not support the required `signAndExecuteTransactionBlock` feature.');
            }

            setTransactionStage('signing');
            console.log('------------------------------------------------------------------');
            console.log('[handleStakeButtonClick] >>> Attempting signAndExecuteTransactionAsync... <<<'); // LOG 21
            console.log('[handleStakeButtonClick] Wallet pop-up should appear now.');
            console.log('------------------------------------------------------------------');

            // Use 'as any' workaround for persistent type error
            const response = await signAndExecuteTransactionAsync({
                transaction: tx as any,
            });

            console.log('[handleStakeButtonClick] <<< signAndExecuteTransactionAsync call returned >>>'); // LOG 22
            console.log('[handleStakeButtonClick] Raw sign+execute response:', response); // LOG 23

            if (!response || !response.digest) {
                 console.error("[handleStakeButtonClick] Invalid response after signing:", response);
                throw new Error('Transaction signed, but no digest was returned. Please check wallet connection or logs.');
            }
            currentTxDigest = response.digest;
            console.log('[handleStakeButtonClick] Transaction Digest Received:', currentTxDigest); // LOG 24

            setTransactionStage('executing');
            setTransactionHash(currentTxDigest);
            console.log('[handleStakeButtonClick] Emitting transactionExecuting event.'); // LOG 25
            socketService.emitWalletEvent('transactionExecuting', { /* ... */ });

            console.log('[handleStakeButtonClick] Waiting for transaction confirmation...'); // LOG 26
            setTransactionStage('confirming');
            socketService.emitWalletEvent('transactionConfirming', { /* ... */ });

            // Let TS infer the type of confirmedTx
            const confirmedTx = await suiClient.waitForTransaction({
                digest: currentTxDigest,
                options: {
                    showEffects: true,
                    showEvents: true,
                },
            });

            console.log('[handleStakeButtonClick] Transaction Confirmation Response:', confirmedTx); // LOG 27

            // Check effects status using optional chaining defensively
            if (confirmedTx?.effects?.status?.status !== 'success') {
                 const errorMsg = `Transaction failed on-chain with status: ${confirmedTx?.effects?.status?.error || 'Unknown error'}`;
                 console.error('[handleStakeButtonClick] On-chain execution failed:', errorMsg, confirmedTx?.effects); // LOG 28
                throw new Error(errorMsg);
            }

            console.log('[handleStakeButtonClick] Transaction confirmed successfully on-chain.'); // LOG 29
            setTransactionStage('success');
            socketService.emitWalletEvent('transactionSuccess', { /* ... */ });

        } catch (error: any) {
            console.error(`[handleStakeButtonClick] 🔴🔴🔴 ERROR Caught during stage: ${transactionStage} 🔴🔴🔴`); // LOG 30
            console.error('[handleStakeButtonClick] Error Name:', error.name); // LOG 31
            console.error('[handleStakeButtonClick] Error Message:', error.message); // LOG 32
            console.error('[handleStakeButtonClick] Full Error Object:', error); // LOG 33
            console.error('[handleStakeButtonClick] Transaction Block state at error:', JSON.stringify(tx?.blockData, null, 2)); // LOG 34

            let errorMessage = error.message || 'An unknown error occurred during the transaction.';
            // ... (Refined error message handling) ...
             if (error.name === 'WalletNoAccountSelectedError') { errorMessage = 'No account selected in wallet.'; }
            else if (errorMessage.includes('rejected') || errorMessage.includes('cancelled') || errorMessage.includes('denied') || error.name === 'UserRejectedRequestError') { errorMessage = 'Transaction rejected or cancelled in wallet.'; }
            else if (errorMessage.includes('Insufficient gas') || errorMessage.includes('GasBalanceTooLow') || errorMessage.includes('Cannot find gas coin')) { errorMessage = 'Insufficient SUI balance for the transaction and/or gas fees.'; }
            else if (errorMessage.includes('MoveAbort') || errorMessage.includes('ExecutionError')) { errorMessage = `Transaction failed during Move execution: ${error.message}`; }
            else if (errorMessage.includes('Coin balance insufficient')) { errorMessage = `Insufficient ${tokenType} balance.`; }
            else if (errorMessage.includes('toJSON is not a function')) { errorMessage = 'Internal Error: Incompatibility between transaction object and signing function. Check package versions.'; }


            console.error('[handleStakeButtonClick] Setting error state:', errorMessage); // LOG 35
            setTransactionError(errorMessage);
            if (transactionStage !== 'error') { setTransactionStage('error'); }

            console.error('[handleStakeButtonClick] Emitting transactionError event.'); // LOG 36
            socketService.emitWalletEvent('transactionError', { /* ... simplified error payload ... */ });
        }
    };

    const handleFinalizeGameCreation = () => {
         console.log(`[handleFinalizeGameCreation] Called with: ${stakeAmount} ${selectedToken}`);
        onCreateGame(selectedToken, stakeAmount);
        setTransactionStage('idle');
        setTransactionError(undefined);
        setTransactionHash(undefined);
        setStakeAmount('');
    };


    return (
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

           {/* Use isPending for loading state */}
           {isPending && <div className="loading-overlay">Waiting for Wallet Confirmation...</div>}

           {/* Main Content */}
           {!isPending && transactionStage === 'idle' ? ( // Hide options grid while signing
                <div className="stake-options">
                    <h3>Select Stake Amount</h3>
                     {/* *** RESTORED BUTTON MAPPING LOGIC *** */}
                    <div className="options-grid">
                        {(selectedToken === 'SUI' ? suiOptions : suimonOptions).map((option: OptionType) => (
                            <button
                                key={option.value}
                                className={`stake-button ${stakeAmount === option.value ? 'selected' : ''}`} // Keep selection style
                                onClick={() => setStakeAmount(option.value)} // Set stake amount on click
                                disabled={!isConnected} // Keep disabled if not connected
                            >
                                {option.label} {/* Display the actual label */}
                                {selectedToken === 'SUI' && <span className="gas-fee">+ Gas Fee</span>} {/* Show gas fee note for SUI */}
                            </button>
                        ))}
                    </div>
                    {isConnected ? (
                        <button className="stake-now-button" onClick={() => handleStakeButtonClick(selectedToken, stakeAmount)} disabled={!stakeAmount || transactionStage !== 'idle' || isPending}>
                             {/* Button text relies on stakeAmount being set by the options */}
                            {stakeAmount ? `Stake ${stakeAmount} ${selectedToken}` : 'Select Amount'}
                        </button>
                    ) : ( <div className="connect-wallet-prompt"> Connect wallet to stake </div> )}
                </div>
           ) : (
                // Show status only if not idle OR if signing
                (transactionStage !== 'idle' || isPending) &&
                <TransactionStatus
                    stage={isPending ? 'signing' : transactionStage} // Show signing stage immediately
                    error={transactionError}
                    onCreateGame={handleFinalizeGameCreation}
                    tokenType={selectedToken}
                    amount={stakeAmount}
                    transactionHash={transactionHash}
                 />
            )}
       </div>
    );
};

export default GameOptions;