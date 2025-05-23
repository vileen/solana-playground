/**
 * Script to search for a specific transaction by signature
 * This script checks if a transaction exists and shows its details
 */
import { Connection } from '@solana/web3.js';
import { config as dotenvConfig } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { FULL_RPC_URL } from '../config/config.js';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../../');

// Load environment variables from .env.local
console.log('Loading environment variables from .env.local');
dotenvConfig({ path: join(rootDir, '.env.local') });

// Constants
const TOKEN_MINT_ADDRESS = '31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk';
const STAKING_CONTRACT_ADDRESS = 'GpUmCRvdKF7EkiufUTCPDvPgy6Fi4GXtrLgLSwLCCyLd';
const CONTRACT_TOKEN_ACCOUNT = 'JAji7pYxBgtDw1RGXhjH7tT1HzSD42FfZ5sAfyw5cz3A';

async function main() {
  try {
    // Command line arguments
    const signature = process.argv[2];
    const walletAddress = process.argv[3];

    if (!signature) {
      console.log('Usage: yarn search:transaction <signature> [wallet-address]');
      console.log(
        'Example: yarn search:transaction pJo4MFP99wiVQUqoEMHRpeQHR9ui9oNDGYFx7j2b5eHkGmBvum9L8VH3LNnGEnqmP853Bb4MMwturw8umamZj8c F5Vw7k9rwy9QFtbjJdvnyJiA6Hs3bfxszeuYMDQXHQtd'
      );
      process.exit(1);
    }

    console.log(`Searching for transaction: ${signature}`);
    if (walletAddress) {
      console.log(`Related to wallet: ${walletAddress}`);
    }

    // Create connection with API key
    const connectionConfig = {
      commitment: 'confirmed' as const,
      confirmTransactionInitialTimeout: 60000,
    };

    console.log('Creating Solana connection...');
    const connection = new Connection(FULL_RPC_URL, connectionConfig);

    // Get transaction details
    console.log('Fetching transaction...');
    const tx = await connection.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      console.log('Transaction not found or is too old.');
      process.exit(1);
    }

    console.log('Transaction found!');
    console.log(
      'Timestamp:',
      tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : 'Unknown'
    );

    // Check for token transfers
    const preBalances = tx.meta?.preTokenBalances || [];
    const postBalances = tx.meta?.postTokenBalances || [];

    let involvedInStaking = false;
    let isDeposit = false;
    let isWithdrawal = false;
    let amount = 0;
    let fromWallet = '';
    let toWallet = '';

    // Look for the token account belonging to the contract
    let contractTokenAccountInvolved = false;
    for (const balance of [...preBalances, ...postBalances]) {
      if (balance.mint === TOKEN_MINT_ADDRESS) {
        const accountKey =
          tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString();
        if (accountKey === CONTRACT_TOKEN_ACCOUNT) {
          contractTokenAccountInvolved = true;
          break;
        }
      }
    }

    if (contractTokenAccountInvolved) {
      console.log('This transaction involves the staking contract token account!');

      // Find pre and post balances for the contract token account
      const contractPreBalance = preBalances.find(
        balance =>
          tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString() ===
          CONTRACT_TOKEN_ACCOUNT
      );

      const contractPostBalance = postBalances.find(
        balance =>
          tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString() ===
          CONTRACT_TOKEN_ACCOUNT
      );

      if (contractPreBalance && contractPostBalance) {
        const contractPreAmount = contractPreBalance.uiTokenAmount.uiAmount || 0;
        const contractPostAmount = contractPostBalance.uiTokenAmount.uiAmount || 0;

        // If contract balance increased, it's a deposit
        if (contractPostAmount > contractPreAmount) {
          isDeposit = true;
          amount = contractPostAmount - contractPreAmount;

          // Find which user account sent the tokens
          for (const preBalance of preBalances) {
            const accountIndex = preBalance.accountIndex;
            if (
              tx.transaction.message.accountKeys[accountIndex].pubkey.toString() !==
                CONTRACT_TOKEN_ACCOUNT &&
              preBalance.mint === TOKEN_MINT_ADDRESS
            ) {
              const userPreAmount = preBalance.uiTokenAmount.uiAmount || 0;

              // Find matching post balance
              const userPostBalance = postBalances.find(
                pb =>
                  tx.transaction.message.accountKeys[pb.accountIndex].pubkey.toString() ===
                  tx.transaction.message.accountKeys[accountIndex].pubkey.toString()
              );

              const userPostAmount = userPostBalance?.uiTokenAmount.uiAmount || 0;

              if (
                userPreAmount > userPostAmount &&
                Math.abs(userPreAmount - userPostAmount - amount) < 1
              ) {
                fromWallet = preBalance.owner || '';
                involvedInStaking = true;
                break;
              }
            }
          }
        }

        // If contract balance decreased, it's a withdrawal
        if (contractPreAmount > contractPostAmount) {
          isWithdrawal = true;
          amount = contractPreAmount - contractPostAmount;

          // Find which user account received the tokens
          for (const postBalance of postBalances) {
            const accountIndex = postBalance.accountIndex;
            if (
              tx.transaction.message.accountKeys[accountIndex].pubkey.toString() !==
                CONTRACT_TOKEN_ACCOUNT &&
              postBalance.mint === TOKEN_MINT_ADDRESS
            ) {
              const userPostAmount = postBalance.uiTokenAmount.uiAmount || 0;

              // Find matching pre balance
              const userPreBalance = preBalances.find(
                pb =>
                  tx.transaction.message.accountKeys[pb.accountIndex].pubkey.toString() ===
                  tx.transaction.message.accountKeys[accountIndex].pubkey.toString()
              );

              const userPreAmount = userPreBalance?.uiTokenAmount.uiAmount || 0;

              if (
                userPostAmount > userPreAmount &&
                Math.abs(userPostAmount - userPreAmount - amount) < 1
              ) {
                toWallet = postBalance.owner || '';
                involvedInStaking = true;
                break;
              }
            }
          }
        }
      }

      if (involvedInStaking) {
        console.log('Transaction type:', isDeposit ? 'DEPOSIT' : 'WITHDRAWAL');
        console.log('Amount:', amount, 'tokens');
        if (isDeposit) {
          console.log('From wallet:', fromWallet);
        }
        if (isWithdrawal) {
          console.log('To wallet:', toWallet);
        }

        // Check if transaction involves the specified wallet
        if (walletAddress) {
          const walletInvolved = fromWallet === walletAddress || toWallet === walletAddress;
          console.log(
            `Transaction ${walletInvolved ? 'INVOLVES' : 'does NOT involve'} the specified wallet: ${walletAddress}`
          );
        }
      } else {
        console.log(
          'Transaction involves the contract token account but does not appear to be a deposit or withdrawal.'
        );
      }
    } else {
      console.log('This transaction does not involve the staking contract token account.');
    }

    // Print raw transaction data for debugging
    console.log('\nRaw transaction data:');
    console.log(JSON.stringify(tx, null, 2));
  } catch (error) {
    console.error('Error searching for transaction:', error);
    process.exit(1);
  }
}

main();
