import { Connection, PublicKey } from '@solana/web3.js';
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

// Target transaction to check
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

async function diagnoseTokenAccountIssue() {
  console.log('=== Diagnosing Token Account Issue ===\n');

  try {
    const connection = new Connection(FULL_RPC_URL!, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });

    // 1. Find all token accounts owned by the staking contract
    console.log('1. Finding all token accounts owned by the staking contract...');
    const stakingContractPubkey = new PublicKey(STAKING_CONTRACT_ADDRESS);
    const tokenMintPubkey = new PublicKey(TOKEN_MINT_ADDRESS);

    const tokenAccounts = await connection.getTokenAccountsByOwner(stakingContractPubkey, {
      mint: tokenMintPubkey,
    });

    console.log(`Found ${tokenAccounts.value.length} token account(s) for the staking contract:`);

    tokenAccounts.value.forEach((account, index) => {
      console.log(`  Account ${index + 1}: ${account.pubkey.toString()}`);
      if (account.pubkey.toString() === CONTRACT_TOKEN_ACCOUNT) {
        console.log(`    ✓ This is the expected CONTRACT_TOKEN_ACCOUNT`);
      } else {
        console.log(`    ✗ This is NOT the expected account`);
      }
    });

    // 2. Check what account the system would use
    const systemUsedAccount = tokenAccounts.value[0]?.pubkey;
    console.log(`\n2. The system would use account: ${systemUsedAccount?.toString()}`);

    if (systemUsedAccount?.toString() !== CONTRACT_TOKEN_ACCOUNT) {
      console.log(
        '⚠️  WARNING: The system is using a DIFFERENT account than CONTRACT_TOKEN_ACCOUNT!'
      );
      console.log('   This could cause missing transactions!');
    }

    // 3. Check if target transaction involves the correct account
    console.log('\n3. Checking if target transaction involves the correct account...');
    console.log(`   Transaction: ${TARGET_TRANSACTION}`);

    // Check signatures for both accounts
    console.log('\n4. Checking recent signatures for each account...');

    for (let i = 0; i < tokenAccounts.value.length; i++) {
      const account = tokenAccounts.value[i];
      console.log(`\n   Account ${i + 1}: ${account.pubkey.toString()}`);

      try {
        // Get recent signatures
        const signatures = await connection.getSignaturesForAddress(account.pubkey, {
          limit: 1000,
        });
        console.log(`   Found ${signatures.length} recent signatures`);

        // Check if target transaction is in this account's history
        const hasTargetTx = signatures.some(sig => sig.signature === TARGET_TRANSACTION);

        if (hasTargetTx) {
          console.log(`   ✓ TARGET TRANSACTION FOUND in this account!`);
        } else {
          console.log(`   ✗ Target transaction NOT found in recent history`);
        }

        // Get account balance
        const accountInfo = await connection.getParsedAccountInfo(account.pubkey);
        if (accountInfo.value && 'parsed' in accountInfo.value.data) {
          const balance = accountInfo.value.data.parsed.info.tokenAmount.uiAmount;
          console.log(`   Current balance: ${balance} tokens`);
        }
      } catch (error) {
        console.error(`   Error checking account: ${error}`);
      }
    }

    // 5. Fetch the specific transaction to see which accounts it involves
    console.log('\n5. Fetching target transaction details...');
    const tx = await connection.getParsedTransaction(TARGET_TRANSACTION, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (tx) {
      console.log('   Transaction found!');
      console.log(`   Block time: ${new Date(tx.blockTime! * 1000).toISOString()}`);

      // Check token balances
      const preBalances = tx.meta?.preTokenBalances || [];
      const postBalances = tx.meta?.postTokenBalances || [];

      console.log('\n   Token accounts involved:');
      [...preBalances, ...postBalances].forEach(balance => {
        if (balance.mint === TOKEN_MINT_ADDRESS) {
          const accountKey =
            tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString();
          console.log(`   - ${accountKey}`);
          if (accountKey === CONTRACT_TOKEN_ACCOUNT) {
            console.log('     ✓ This is the CONTRACT_TOKEN_ACCOUNT');
          }
          if (accountKey === systemUsedAccount?.toString()) {
            console.log('     → This is the account the system would fetch from');
          }
        }
      });
    } else {
      console.log('   Transaction not found!');
    }

    // 6. Compare transaction counts
    console.log('\n6. Comparing transaction counts between accounts...');
    const contractTokenAccountPubkey = new PublicKey(CONTRACT_TOKEN_ACCOUNT);

    // Get all signatures for the correct account
    let correctAccountSigs = 0;
    let systemAccountSigs = 0;

    try {
      let sigs = await connection.getSignaturesForAddress(contractTokenAccountPubkey, {
        limit: 1000,
      });
      correctAccountSigs = sigs.length;

      while (sigs.length === 1000) {
        const lastSig = sigs[sigs.length - 1].signature;
        sigs = await connection.getSignaturesForAddress(contractTokenAccountPubkey, {
          limit: 1000,
          before: lastSig,
        });
        correctAccountSigs += sigs.length;
      }
    } catch (error) {
      console.error('Error counting correct account signatures:', error);
    }

    if (systemUsedAccount && systemUsedAccount.toString() !== CONTRACT_TOKEN_ACCOUNT) {
      try {
        let sigs = await connection.getSignaturesForAddress(systemUsedAccount, { limit: 1000 });
        systemAccountSigs = sigs.length;

        while (sigs.length === 1000) {
          const lastSig = sigs[sigs.length - 1].signature;
          sigs = await connection.getSignaturesForAddress(systemUsedAccount, {
            limit: 1000,
            before: lastSig,
          });
          systemAccountSigs += sigs.length;
        }
      } catch (error) {
        console.error('Error counting system account signatures:', error);
      }
    }

    console.log(`\n   CONTRACT_TOKEN_ACCOUNT has: ${correctAccountSigs}+ transactions`);
    if (systemUsedAccount && systemUsedAccount.toString() !== CONTRACT_TOKEN_ACCOUNT) {
      console.log(`   System-used account has: ${systemAccountSigs}+ transactions`);
      console.log(
        `   Difference: ${Math.abs(correctAccountSigs - systemAccountSigs)} transactions`
      );
    }

    // 7. Recommendations
    console.log('\n=== DIAGNOSIS SUMMARY ===');
    if (systemUsedAccount?.toString() !== CONTRACT_TOKEN_ACCOUNT) {
      console.log('❌ CRITICAL ISSUE FOUND:');
      console.log('   The staking service is fetching transactions from the WRONG token account!');
      console.log(`   It should use: ${CONTRACT_TOKEN_ACCOUNT}`);
      console.log(`   But it uses:   ${systemUsedAccount?.toString()}`);
      console.log('\n   This means many transactions (deposits/withdrawals) are being MISSED!');
      console.log('\n   FIX: Update stakingService.ts to use CONTRACT_TOKEN_ACCOUNT directly');
      console.log('        instead of using tokenAccounts.value[0].pubkey');
    } else {
      console.log('✓ The system is using the correct token account.');
    }
  } catch (error) {
    console.error('Error in diagnosis:', error);
  }
}

// Run diagnosis
diagnoseTokenAccountIssue();
