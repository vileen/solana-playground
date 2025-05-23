import { Connection } from '@solana/web3.js';
import { config as dotenvConfig } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../../');

// Load environment variables
dotenvConfig({ path: join(rootDir, '.env.local') });

// Contract addresses
const STAKING_CONTRACT_ADDRESS = 'GpUmCRvdKF7EkiufUTCPDvPgy6Fi4GXtrLgLSwLCCyLd';
const TOKEN_MINT_ADDRESS = '31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk';
const CONTRACT_TOKEN_ACCOUNT = 'JAji7pYxBgtDw1RGXhjH7tT1HzSD42FfZ5sAfyw5cz3A';

// Target transaction and wallet
const TARGET_TRANSACTION =
  'pJo4MFP99wiVQUqoEMHRpeQHR9ui9oNDGYFx7j2b5eHkGmBvum9L8VH3LNnGEnqmP853Bb4MMwturw8umamZj8c';
const TARGET_WALLET = 'F5Vw7k9rwy9QFtbjJdvnyJiA6Hs3bfxszeuYMDQXHQtd';

// Get RPC URL with API key
const RPC_URL = process.env.SOLANA_RPC_URL;
const API_KEY = process.env.SOLANA_API_KEY;

let FULL_RPC_URL = RPC_URL;
if (API_KEY && RPC_URL && !RPC_URL.includes('api-key=') && !RPC_URL.includes('@')) {
  FULL_RPC_URL = RPC_URL.includes('?')
    ? `${RPC_URL}&api-key=${API_KEY}`
    : `${RPC_URL}?api-key=${API_KEY}`;
}

async function debugSpecificWithdrawal() {
  console.log('=== Debugging Specific Withdrawal Transaction ===\n');
  console.log(`Target transaction: ${TARGET_TRANSACTION}`);
  console.log(`Target wallet: ${TARGET_WALLET}`);
  console.log(`Contract: ${STAKING_CONTRACT_ADDRESS}`);
  console.log(`Contract token account: ${CONTRACT_TOKEN_ACCOUNT}\n`);

  try {
    const connection = new Connection(FULL_RPC_URL!, { commitment: 'confirmed' });

    // Get the specific transaction
    console.log('Fetching transaction details...');
    const tx = await connection.getParsedTransaction(TARGET_TRANSACTION, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      console.error('Transaction not found!');
      return;
    }

    console.log(`Transaction found. Block time: ${new Date(tx.blockTime! * 1000).toISOString()}`);
    console.log(`Transaction status: ${tx.meta?.err ? 'FAILED' : 'SUCCESS'}`);

    if (tx.meta?.err) {
      console.log('Transaction failed, skipping analysis');
      return;
    }

    // Analyze token balances
    const preBalances = tx.meta?.preTokenBalances || [];
    const postBalances = tx.meta?.postTokenBalances || [];

    console.log('\n=== Pre-transaction Token Balances ===');
    preBalances.forEach((balance, i) => {
      if (balance.mint === TOKEN_MINT_ADDRESS) {
        const accountKey =
          tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString();
        console.log(`Account #${i}: ${accountKey}`);
        console.log(`  Owner: ${balance.owner}`);
        console.log(`  Amount: ${balance.uiTokenAmount.uiAmount}`);
        console.log(`  Is contract account: ${accountKey === CONTRACT_TOKEN_ACCOUNT}`);
        console.log(`  Is target wallet: ${balance.owner === TARGET_WALLET}`);
      }
    });

    console.log('\n=== Post-transaction Token Balances ===');
    postBalances.forEach((balance, i) => {
      if (balance.mint === TOKEN_MINT_ADDRESS) {
        const accountKey =
          tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString();
        console.log(`Account #${i}: ${accountKey}`);
        console.log(`  Owner: ${balance.owner}`);
        console.log(`  Amount: ${balance.uiTokenAmount.uiAmount}`);
        console.log(`  Is contract account: ${accountKey === CONTRACT_TOKEN_ACCOUNT}`);
        console.log(`  Is target wallet: ${balance.owner === TARGET_WALLET}`);
      }
    });

    // Calculate balance changes
    console.log('\n=== Balance Changes Analysis ===');

    // Find contract account changes
    const contractPreBalance = preBalances.find(
      balance =>
        balance.mint === TOKEN_MINT_ADDRESS &&
        tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString() ===
          CONTRACT_TOKEN_ACCOUNT
    );

    const contractPostBalance = postBalances.find(
      balance =>
        balance.mint === TOKEN_MINT_ADDRESS &&
        tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString() ===
          CONTRACT_TOKEN_ACCOUNT
    );

    if (contractPreBalance && contractPostBalance) {
      const contractPreAmount = contractPreBalance.uiTokenAmount.uiAmount || 0;
      const contractPostAmount = contractPostBalance.uiTokenAmount.uiAmount || 0;
      const contractChange = contractPostAmount - contractPreAmount;

      console.log(
        `Contract account balance change: ${contractPreAmount} -> ${contractPostAmount} (${contractChange})`
      );

      if (contractChange < 0) {
        console.log(`✓ This is a withdrawal of ${Math.abs(contractChange)} tokens`);
      } else if (contractChange > 0) {
        console.log(`✓ This is a deposit of ${contractChange} tokens`);
      } else {
        console.log(`? No change in contract balance`);
      }
    } else {
      console.log('❌ Could not find contract account in balances');
    }

    // Find target wallet changes
    const walletPreBalance = preBalances.find(
      balance => balance.mint === TOKEN_MINT_ADDRESS && balance.owner === TARGET_WALLET
    );

    const walletPostBalance = postBalances.find(
      balance => balance.mint === TOKEN_MINT_ADDRESS && balance.owner === TARGET_WALLET
    );

    if (walletPreBalance && walletPostBalance) {
      const walletPreAmount = walletPreBalance.uiTokenAmount.uiAmount || 0;
      const walletPostAmount = walletPostBalance.uiTokenAmount.uiAmount || 0;
      const walletChange = walletPostAmount - walletPreAmount;

      console.log(
        `Target wallet balance change: ${walletPreAmount} -> ${walletPostAmount} (${walletChange})`
      );

      if (walletChange > 0) {
        console.log(`✓ Wallet received ${walletChange} tokens`);
      } else if (walletChange < 0) {
        console.log(`✓ Wallet sent ${Math.abs(walletChange)} tokens`);
      } else {
        console.log(`? No change in wallet balance`);
      }
    } else {
      console.log('❌ Could not find target wallet account in balances');
      console.log('Available wallet owners in transaction:');
      [...preBalances, ...postBalances].forEach(balance => {
        if (balance.mint === TOKEN_MINT_ADDRESS && balance.owner) {
          console.log(`  - ${balance.owner}`);
        }
      });
    }

    // Detailed withdrawal processing simulation
    console.log('\n=== Simulating Withdrawal Processing Logic ===');

    const contractTokenAccounts = new Set<string>();
    const userTokenAccounts = new Map<string, string>();

    // Identify accounts
    [...preBalances, ...postBalances].forEach(balance => {
      if (balance.mint === TOKEN_MINT_ADDRESS) {
        const accountIndex = balance.accountIndex;
        const accountKey = tx.transaction.message.accountKeys[accountIndex].pubkey.toString();

        if (balance.owner === STAKING_CONTRACT_ADDRESS) {
          contractTokenAccounts.add(accountKey);
        } else if (balance.owner) {
          userTokenAccounts.set(accountKey, balance.owner);
        }
      }
    });

    console.log(`Contract token accounts found: ${contractTokenAccounts.size}`);
    console.log(`User token accounts found: ${userTokenAccounts.size}`);

    // Process contract accounts
    for (const contractAccount of contractTokenAccounts) {
      const contractPreBalance = preBalances.find(
        balance =>
          tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString() ===
          contractAccount
      );

      const contractPostBalance = postBalances.find(
        balance =>
          tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString() ===
          contractAccount
      );

      if (contractPreBalance && contractPostBalance) {
        const contractPreAmount = contractPreBalance.uiTokenAmount.uiAmount || 0;
        const contractPostAmount = contractPostBalance.uiTokenAmount.uiAmount || 0;

        if (contractPreAmount > contractPostAmount) {
          const withdrawalAmount = contractPreAmount - contractPostAmount;
          console.log(`Contract withdrew ${withdrawalAmount} tokens`);

          let withdrawalRecorded = false;

          // Find matching user account
          for (const [userAccount, ownerAddress] of userTokenAccounts.entries()) {
            const userPreBalance = preBalances.find(
              balance =>
                tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString() ===
                userAccount
            );

            const userPostBalance = postBalances.find(
              balance =>
                tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString() ===
                userAccount
            );

            // Handle both cases: existing account (has pre-balance) and new account (no pre-balance)
            if (userPostBalance) {
              const userPreAmount = userPreBalance?.uiTokenAmount.uiAmount || 0; // Default to 0 if no pre-balance
              const userPostAmount = userPostBalance.uiTokenAmount.uiAmount || 0;
              const gainAmount = userPostAmount - userPreAmount;

              console.log(`  User account ${userAccount} (owner: ${ownerAddress})`);
              console.log(
                `    Pre: ${userPreAmount}, Post: ${userPostAmount}, Gain: ${gainAmount}`
              );
              console.log(`    Withdrawal amount: ${withdrawalAmount}`);
              console.log(`    Difference: ${Math.abs(gainAmount - withdrawalAmount)}`);
              console.log(`    Has pre-balance: ${!!userPreBalance}`);

              const tolerance = Math.max(1, withdrawalAmount * 0.001);
              console.log(`    Tolerance: ${tolerance}`);

              if (
                userPostAmount > userPreAmount &&
                Math.abs(gainAmount - withdrawalAmount) < tolerance
              ) {
                console.log(
                  `    ✓ MATCH FOUND - This withdrawal should be recorded for ${ownerAddress}`
                );
                withdrawalRecorded = true;

                if (ownerAddress === TARGET_WALLET) {
                  console.log(`    ✓ This is our target wallet - withdrawal should be applied!`);
                }
              } else {
                console.log(`    ✗ No match - tolerance check failed or no gain`);
              }
            }
          }

          if (!withdrawalRecorded) {
            console.log(`  ❌ Withdrawal not recorded - no matching user account found`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the debug
debugSpecificWithdrawal();
