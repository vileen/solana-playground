import { Connection } from '@solana/web3.js';
import { config as dotenvConfig } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Import the staking service functions
import { fetchStakingData } from '../services/stakingService.js';

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

// Target wallet and transaction
const TARGET_WALLET = 'F5Vw7k9rwy9QFtbjJdvnyJiA6Hs3bfxszeuYMDQXHQtd';
const TARGET_TRANSACTION =
  'pJo4MFP99wiVQUqoEMHRpeQHR9ui9oNDGYFx7j2b5eHkGmBvum9L8VH3LNnGEnqmP853Bb4MMwturw8umamZj8c';

// Get RPC URL with API key
const RPC_URL = process.env.SOLANA_RPC_URL;
const API_KEY = process.env.SOLANA_API_KEY;

let FULL_RPC_URL = RPC_URL;
if (API_KEY && RPC_URL && !RPC_URL.includes('api-key=') && !RPC_URL.includes('@')) {
  FULL_RPC_URL = RPC_URL.includes('?')
    ? `${RPC_URL}&api-key=${API_KEY}`
    : `${RPC_URL}?api-key=${API_KEY}`;
}

async function diagnoseWithdrawalProcessing() {
  console.log('=== Diagnosing Withdrawal Processing Issue ===\n');

  try {
    const connection = new Connection(FULL_RPC_URL!, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });

    // 1. First, manually check the transaction
    console.log('1. Checking target transaction details...');
    const tx = await connection.getParsedTransaction(TARGET_TRANSACTION, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      console.log('Transaction not found!');
      return;
    }

    console.log(`   Transaction found!`);
    console.log(`   Block time: ${new Date(tx.blockTime! * 1000).toISOString()}`);
    console.log(`   Slot: ${tx.slot}`);

    // Analyze token transfers
    const preBalances = tx.meta?.preTokenBalances || [];
    const postBalances = tx.meta?.postTokenBalances || [];

    let contractPreAmount = 0;
    let contractPostAmount = 0;
    let walletPreAmount = 0;
    let walletPostAmount = 0;
    let walletAccount = '';

    // Check pre-balances
    for (const balance of preBalances) {
      if (balance.mint === TOKEN_MINT_ADDRESS) {
        const accountKey =
          tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString();
        const amount = balance.uiTokenAmount.uiAmount || 0;

        if (accountKey === CONTRACT_TOKEN_ACCOUNT) {
          contractPreAmount = amount;
        } else if (balance.owner === TARGET_WALLET) {
          walletPreAmount = amount;
          walletAccount = accountKey;
        }
      }
    }

    // Check post-balances
    for (const balance of postBalances) {
      if (balance.mint === TOKEN_MINT_ADDRESS) {
        const accountKey =
          tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString();
        const amount = balance.uiTokenAmount.uiAmount || 0;

        if (accountKey === CONTRACT_TOKEN_ACCOUNT) {
          contractPostAmount = amount;
        } else if (balance.owner === TARGET_WALLET) {
          walletPostAmount = amount;
        }
      }
    }

    const contractChange = contractPostAmount - contractPreAmount;
    const walletChange = walletPostAmount - walletPreAmount;

    console.log('\n   Token balance changes:');
    console.log(
      `   Contract account: ${contractPreAmount} → ${contractPostAmount} (${contractChange > 0 ? '+' : ''}${contractChange})`
    );
    console.log(
      `   Wallet account:   ${walletPreAmount} → ${walletPostAmount} (${walletChange > 0 ? '+' : ''}${walletChange})`
    );

    if (contractChange < 0 && walletChange > 0) {
      console.log(`\n   ✓ This is a WITHDRAWAL of ${Math.abs(contractChange)} tokens`);
    } else if (contractChange > 0 && walletChange < 0) {
      console.log(`\n   ✓ This is a DEPOSIT of ${contractChange} tokens`);
    } else {
      console.log(`\n   ⚠️  Unexpected transaction type`);
    }

    // 2. Now run the staking service to see if it detects this transaction
    console.log('\n2. Running fetchStakingData to see if it processes this transaction...');
    console.log('   Note: Look for transaction signature in the logs');
    console.log(`   Looking for: ${TARGET_TRANSACTION}`);

    // Temporarily set console.log to capture all logs
    const originalLog = console.log;
    let capturedLogs: string[] = [];
    let foundTransaction = false;
    let foundWallet = false;

    console.log = (...args: any[]) => {
      const logStr = args.join(' ');
      capturedLogs.push(logStr);

      // Check if this log mentions our transaction
      if (logStr.includes(TARGET_TRANSACTION)) {
        foundTransaction = true;
      }

      // Check if this log mentions our wallet
      if (logStr.includes(TARGET_WALLET)) {
        foundWallet = true;
      }

      // Still output to console
      originalLog.apply(console, args);
    };

    try {
      // Run the staking data fetch
      const result = await fetchStakingData();

      // Restore console.log
      console.log = originalLog;

      console.log('\n3. Analysis of fetchStakingData results:');
      console.log(`   Total wallets found: ${result.stakingData.length}`);

      // Find our target wallet
      const targetWalletData = result.stakingData.find(w => w.walletAddress === TARGET_WALLET);

      if (targetWalletData) {
        console.log(`\n   ✓ Found target wallet ${TARGET_WALLET}`);
        console.log(`   Total staked: ${targetWalletData.totalStaked}`);
        console.log(`   Total locked: ${targetWalletData.totalLocked}`);
        console.log(`   Total unlocked: ${targetWalletData.totalUnlocked}`);
        console.log(`   Number of stakes: ${targetWalletData.stakes.length}`);

        console.log('\n   Individual stakes:');
        targetWalletData.stakes.forEach((stake, i) => {
          console.log(
            `   ${i + 1}. ${stake.amount} tokens - ${stake.isLocked ? 'LOCKED' : 'UNLOCKED'} (unlocks ${stake.unlockDate})`
          );
        });

        // Check if the unlocked amount includes our withdrawal
        if (targetWalletData.totalUnlocked >= 15492) {
          console.log(
            '\n   ⚠️  The unlocked amount includes the 15,492 tokens that were already withdrawn!'
          );
          console.log('      This confirms the withdrawal was NOT properly processed.');
        }
      } else {
        console.log(`\n   ✗ Target wallet ${TARGET_WALLET} NOT found in results`);
      }

      console.log(
        `\n   Transaction ${TARGET_TRANSACTION} was ${foundTransaction ? 'FOUND' : 'NOT FOUND'} in logs`
      );
      console.log(`   Wallet ${TARGET_WALLET} was ${foundWallet ? 'FOUND' : 'NOT FOUND'} in logs`);

      // 4. Check specific logs for our transaction
      console.log('\n4. Checking specific logs for transaction processing:');

      const txLogs = capturedLogs.filter(log => log.includes(TARGET_TRANSACTION));
      if (txLogs.length > 0) {
        console.log('   Logs mentioning the transaction:');
        txLogs.forEach(log => console.log(`   - ${log}`));
      } else {
        console.log('   No logs found mentioning the transaction');
      }

      // 5. Check if pagination might be the issue
      console.log('\n5. Checking transaction history coverage:');

      const sigLogs = capturedLogs.filter(log => log.includes('signatures on page'));
      const totalSigsLog = capturedLogs.find(log => log.includes('Total signatures found:'));

      if (totalSigsLog) {
        console.log(`   ${totalSigsLog}`);
      }

      if (sigLogs.length > 0) {
        console.log(`   Fetched ${sigLogs.length} pages of signatures`);
      }
    } catch (error) {
      console.log = originalLog;
      console.error('Error running fetchStakingData:', error);
    }
  } catch (error) {
    console.error('Error in diagnosis:', error);
  }
}

// Run diagnosis
diagnoseWithdrawalProcessing();
