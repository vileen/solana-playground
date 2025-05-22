/**
 * Script to find and analyze a specific transaction by signature
 * This helps debug why a transaction wasn't detected in the main verification script
 */
import { Connection } from '@solana/web3.js';
import { config as dotenvConfig } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../../');

// Load environment variables from .env.local
console.log('Loading environment variables from .env.local');
dotenvConfig({ path: join(rootDir, '.env.local') });

// Default addresses
const STAKING_CONTRACT_ADDRESS = 'GpUmCRvdKF7EkiufUTCPDvPgy6Fi4GXtrLgLSwLCCyLd';
const TOKEN_MINT_ADDRESS = '31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk';

// Process command line arguments
const args = process.argv.slice(2);
const SIGNATURE =
  args[0] ||
  'pJo4MFP99wiVQUqoEMHRpeQHR9ui9oNDGYFx7j2b5eHkGmBvum9L8VH3LNnGEnqmP853Bb4MMwturw8umamZj8c';

async function findSpecificTransaction() {
  console.log(`=== Analyzing specific transaction ===`);
  console.log(`Signature: ${SIGNATURE}`);
  console.log(`Staking contract: ${STAKING_CONTRACT_ADDRESS}`);
  console.log(`Token mint: ${TOKEN_MINT_ADDRESS}`);

  try {
    // Setup connection to Solana
    const RPC_URL = process.env.SOLANA_RPC_URL;
    if (!RPC_URL) {
      throw new Error('SOLANA_RPC_URL environment variable is not defined');
    }

    // Construct full RPC URL with API key if provided
    let FULL_RPC_URL = RPC_URL;
    const API_KEY = process.env.SOLANA_API_KEY;
    if (API_KEY && !RPC_URL.includes('api-key=') && !RPC_URL.includes('@')) {
      FULL_RPC_URL = RPC_URL.includes('?')
        ? `${RPC_URL}&api-key=${API_KEY}`
        : `${RPC_URL}?api-key=${API_KEY}`;
      console.log('Added API key to RPC URL');
    }

    // Create connection with appropriate configuration
    const connectionConfig = {
      commitment: 'confirmed' as const,
      confirmTransactionInitialTimeout: 60000,
    };

    console.log('Creating Solana connection...');
    const connection = new Connection(FULL_RPC_URL, connectionConfig);

    // Fetch the transaction
    console.log(`\nFetching transaction details for ${SIGNATURE}...`);
    const tx = await connection.getParsedTransaction(SIGNATURE, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      console.log(`Transaction not found or failed to fetch.`);
      return;
    }

    // Extract basic transaction info
    const timestamp = tx.blockTime ? new Date(tx.blockTime * 1000) : new Date();
    const slot = tx.slot;
    const status = tx.meta?.err ? 'Failed' : 'Success';

    console.log(`\n=== Transaction Details ===`);
    console.log(`Date: ${timestamp.toISOString()}`);
    console.log(`Slot: ${slot}`);
    console.log(`Status: ${status}`);

    if (tx.meta?.err) {
      console.log(`Error: ${JSON.stringify(tx.meta.err)}`);
    }

    // Print accounts involved
    console.log(`\n=== Accounts Involved ===`);
    tx.transaction.message.accountKeys.forEach((account, index) => {
      console.log(
        `[${index}] ${account.pubkey.toString()} (Writable: ${account.writable}, Signer: ${account.signer})`
      );
    });

    // Check for SPL token transfers
    const preBalances = tx.meta?.preTokenBalances || [];
    const postBalances = tx.meta?.postTokenBalances || [];

    if (preBalances.length === 0 && postBalances.length === 0) {
      console.log(`\nNo SPL token balances found in this transaction.`);
    } else {
      console.log(`\n=== Pre-Token Balances ===`);
      for (const balance of preBalances) {
        console.log(`Account Index: ${balance.accountIndex}`);
        console.log(`  Owner: ${balance.owner || 'Unknown'}`);
        console.log(`  Mint: ${balance.mint}`);
        console.log(
          `  Amount: ${balance.uiTokenAmount.uiAmount} (${balance.uiTokenAmount.uiAmountString})`
        );
      }

      console.log(`\n=== Post-Token Balances ===`);
      for (const balance of postBalances) {
        console.log(`Account Index: ${balance.accountIndex}`);
        console.log(`  Owner: ${balance.owner || 'Unknown'}`);
        console.log(`  Mint: ${balance.mint}`);
        console.log(
          `  Amount: ${balance.uiTokenAmount.uiAmount} (${balance.uiTokenAmount.uiAmountString})`
        );
      }
    }

    // Check for token balance changes
    console.log(`\n=== Token Balance Changes ===`);
    const accountChanges = new Map<
      number,
      {
        owner: string | undefined;
        mint: string;
        preBal: number;
        postBal: number;
        change: number;
      }
    >();

    // Process pre-balances
    for (const balance of preBalances) {
      const accountKey = balance.accountIndex;
      const owner = balance.owner;
      const mint = balance.mint;
      const amount = balance.uiTokenAmount.uiAmount || 0;

      accountChanges.set(accountKey, {
        owner,
        mint,
        preBal: amount,
        postBal: 0, // Will update from post-balances
        change: 0, // Will calculate after
      });
    }

    // Process post-balances and calculate changes
    for (const balance of postBalances) {
      const accountKey = balance.accountIndex;
      const owner = balance.owner;
      const mint = balance.mint;
      const amount = balance.uiTokenAmount.uiAmount || 0;

      if (accountChanges.has(accountKey)) {
        const existing = accountChanges.get(accountKey)!;
        existing.postBal = amount;
        existing.change = amount - existing.preBal;
      } else {
        accountChanges.set(accountKey, {
          owner,
          mint,
          preBal: 0,
          postBal: amount,
          change: amount,
        });
      }
    }

    // Print the balance changes
    for (const [accountIndex, change] of accountChanges.entries()) {
      const pubkey = tx.transaction.message.accountKeys[accountIndex].pubkey.toString();
      const isContractAccount = change.owner === STAKING_CONTRACT_ADDRESS;
      const isTokenMint = change.mint === TOKEN_MINT_ADDRESS;

      console.log(`Account: ${pubkey} (Index: ${accountIndex})`);
      console.log(`  Owner: ${change.owner || 'Unknown'}`);
      console.log(`  Mint: ${change.mint}${isTokenMint ? ' (TRACKED TOKEN)' : ''}`);
      console.log(`  Pre-balance: ${change.preBal}`);
      console.log(`  Post-balance: ${change.postBal}`);
      console.log(`  Change: ${change.change > 0 ? '+' : ''}${change.change}`);
      console.log(`  Is Contract Account: ${isContractAccount ? 'YES' : 'No'}`);
    }

    // Analyze why this transaction might have been missed
    console.log(`\n=== Analysis ===`);

    // Check if this is a transfer between the contract and a wallet
    let isContractInvolved = false;
    let contractGained = 0;
    let contractLost = 0;
    let walletAddress = '';
    let walletGained = 0;
    let walletLost = 0;

    for (const [accountIndex, change] of accountChanges.entries()) {
      if (change.owner === STAKING_CONTRACT_ADDRESS && change.mint === TOKEN_MINT_ADDRESS) {
        isContractInvolved = true;
        if (change.change > 0) {
          contractGained += change.change;
        } else if (change.change < 0) {
          contractLost += Math.abs(change.change);
        }
      } else if (change.mint === TOKEN_MINT_ADDRESS) {
        walletAddress = change.owner || 'Unknown';
        if (change.change > 0) {
          walletGained += change.change;
        } else if (change.change < 0) {
          walletLost += Math.abs(change.change);
        }
      }
    }

    if (!isContractInvolved) {
      console.log(`REASON: Transaction does not involve the staking contract`);
    } else if (contractGained > 0 && walletLost > 0) {
      console.log(`This appears to be a DEPOSIT transaction`);
      console.log(`Wallet ${walletAddress} sent ${walletLost} tokens to the contract`);
      console.log(`Contract received ${contractGained} tokens`);

      if (Math.abs(contractGained - walletLost) > 1) {
        console.log(
          `REASON: The amounts don't match within tolerance (${Math.abs(contractGained - walletLost)})`
        );
      } else {
        console.log(`POSSIBLE REASON: Transaction might be outside the date range filter`);
        console.log(`Transaction date: ${timestamp.toISOString()}`);
      }
    } else if (contractLost > 0 && walletGained > 0) {
      console.log(`This appears to be a WITHDRAWAL transaction`);
      console.log(`Contract sent ${contractLost} tokens to wallet ${walletAddress}`);
      console.log(`Wallet received ${walletGained} tokens`);

      if (Math.abs(contractLost - walletGained) > 1) {
        console.log(
          `REASON: The amounts don't match within tolerance (${Math.abs(contractLost - walletGained)})`
        );
      } else {
        console.log(`POSSIBLE REASON: Transaction might be outside the date range filter`);
        console.log(`Transaction date: ${timestamp.toISOString()}`);
      }
    } else {
      console.log(
        `REASON: This doesn't appear to be a direct transfer between contract and wallet`
      );
      console.log(`Contract gained: ${contractGained}, Contract lost: ${contractLost}`);
      console.log(`Wallet gained: ${walletGained}, Wallet lost: ${walletLost}`);
    }

    // Instructions on how to improve the verification script
    console.log(`\n=== How to Improve Verification Script ===`);
    console.log(
      `1. Make sure the date range includes this transaction (${timestamp.toISOString()})`
    );
    console.log(
      `2. Check if the pagination in the verification script is correctly fetching all transactions`
    );
    console.log(`3. Adjust the balance change detection logic if needed`);
    console.log(`4. Verify that API rate limits aren't affecting the results`);
  } catch (error) {
    console.error('Error analyzing transaction:', error);
  }
}

// Run the analysis
findSpecificTransaction();
