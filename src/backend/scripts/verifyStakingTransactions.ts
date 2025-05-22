/**
 * Script to verify staking transactions between a specific wallet and the staking contract
 * This tool helps audit and verify all token transfers between two addresses
 */
import { Connection, ParsedTransactionWithMeta, PublicKey } from '@solana/web3.js';
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
const WALLET_ADDRESS = args[0] || 'F5Vw7k9rwy9QFtbjJdvnyJiA6Hs3bfxszeuYMDQXHQtd'; // Default to the test wallet
const START_DATE = args[1] ? new Date(args[1]) : new Date('2023-01-01'); // Extended back to 2023 for better coverage
const END_DATE = args[2] ? new Date(args[2]) : new Date(Date.now() + 86400000); // Extended to tomorrow for better coverage

// Option to directly check a specific transaction
const CHECK_SPECIFIC_TX = args[3];

// Transaction type
type StakingTransaction = {
  type: 'deposit' | 'withdrawal';
  timestamp: Date;
  amount: number;
  signature: string;
  blockTime: number;
  slot: number;
};

async function verifyStakingTransactions() {
  console.log(`=== Verifying staking transactions for wallet: ${WALLET_ADDRESS} ===`);
  console.log(
    `Date range: ${START_DATE.toISOString().split('T')[0]} to ${END_DATE.toISOString().split('T')[0]}`
  );
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

    // Get contract and token pubkeys
    const stakingContractPubkey = new PublicKey(STAKING_CONTRACT_ADDRESS);
    const tokenMintPubkey = new PublicKey(TOKEN_MINT_ADDRESS);
    const walletPubkey = new PublicKey(WALLET_ADDRESS);

    // Fetch token accounts for both the staking contract and wallet
    console.log('\nFinding token accounts...');

    // Fetch the staking contract's token account for this token
    const contractTokenAccounts = await connection.getTokenAccountsByOwner(stakingContractPubkey, {
      mint: tokenMintPubkey,
    });

    if (contractTokenAccounts.value.length === 0) {
      throw new Error('No token accounts found for the staking contract and token');
    }

    const contractTokenAccount = contractTokenAccounts.value[0].pubkey;
    console.log(`Found contract token account: ${contractTokenAccount.toString()}`);

    // Fetch the wallet's token account for this token
    const walletTokenAccounts = await connection.getTokenAccountsByOwner(walletPubkey, {
      mint: tokenMintPubkey,
    });

    if (walletTokenAccounts.value.length === 0) {
      throw new Error('No token accounts found for this wallet and token');
    }

    const walletTokenAccount = walletTokenAccounts.value[0].pubkey;
    console.log(`Found wallet token account: ${walletTokenAccount.toString()}`);

    // Get token balances
    console.log('\nFetching current token balances...');

    const walletTokenInfo = await connection.getParsedAccountInfo(walletTokenAccount);
    const contractTokenInfo = await connection.getParsedAccountInfo(contractTokenAccount);

    let walletBalance = 0;
    let contractBalance = 0;

    if (walletTokenInfo.value && contractTokenInfo.value) {
      const parsedWalletData = walletTokenInfo.value.data;
      const parsedContractData = contractTokenInfo.value.data;

      if ('parsed' in parsedWalletData && 'parsed' in parsedContractData) {
        walletBalance = parsedWalletData.parsed.info.tokenAmount.uiAmount || 0;
        contractBalance = parsedContractData.parsed.info.tokenAmount.uiAmount || 0;

        console.log(`Current wallet balance: ${walletBalance} tokens`);
        console.log(`Current contract balance: ${contractBalance} tokens`);
      }
    }

    // Fetch transactions for the wallet's token account
    console.log('\nFetching transaction history...');

    // Helper function to wait between requests to avoid rate limits
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Use 'before' parameter to paginate through all signatures
    let allSignatures: any[] = [];
    let lastSignature: string | undefined;
    let hasMore = true;
    let page = 1;
    const MAX_PAGES = 20; // Limit to 20 pages to avoid excessive API calls

    while (hasMore && page <= MAX_PAGES) {
      console.log(`Fetching transaction signatures page ${page}/${MAX_PAGES}...`);
      const options: any = { limit: 100 };

      if (lastSignature) {
        options.before = lastSignature;
      }

      try {
        // Get signatures with pagination
        const signatures = await connection.getSignaturesForAddress(walletTokenAccount, options);

        // Filter signatures by date range if we have blockTime
        const filteredSignatures = signatures.filter(sig => {
          if (!sig.blockTime) return true; // Include if we don't have blockTime
          const txDate = new Date(sig.blockTime * 1000);
          return txDate >= START_DATE && txDate <= END_DATE;
        });

        console.log(`Found ${filteredSignatures.length} signatures in date range on page ${page}`);

        // Add to our collection
        allSignatures = [...allSignatures, ...filteredSignatures];

        // Check if we need to continue pagination
        if (signatures.length < 100) {
          hasMore = false;
          console.log('Reached the end of transaction history');
        } else {
          // Get the oldest signature for pagination
          lastSignature = signatures[signatures.length - 1].signature;
          // Add a small delay to avoid rate limiting
          await sleep(1000);
          page++;
        }
      } catch (error) {
        console.error(`Error fetching signatures page ${page}:`, error);
        await sleep(2000); // Wait a bit longer on error

        // If we've tried multiple times, eventually give up
        if (page > 5) {
          console.warn('Giving up after multiple failures');
          hasMore = false;
        }
      }
    }

    console.log(`Total signatures found: ${allSignatures.length}`);

    // Process transactions in batches to avoid rate limits
    const BATCH_SIZE = 5;
    const BATCH_DELAY = 2000;
    const transactions: ParsedTransactionWithMeta[] = [];

    console.log('\nFetching transaction details (this may take a while)...');

    for (let i = 0; i < allSignatures.length; i += BATCH_SIZE) {
      const batchSignatures = allSignatures.slice(i, i + BATCH_SIZE);
      console.log(
        `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allSignatures.length / BATCH_SIZE)}`
      );

      const batchPromises = batchSignatures.map(sig =>
        connection.getParsedTransaction(sig.signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        })
      );

      let batchTransactions;
      try {
        batchTransactions = await Promise.all(batchPromises);

        // Filter out null transactions and errors
        const validBatchTxs = batchTransactions.filter(
          tx => tx !== null
        ) as ParsedTransactionWithMeta[];
        transactions.push(...validBatchTxs);

        // If we have more batches to process, wait before the next batch
        if (i + BATCH_SIZE < allSignatures.length) {
          await sleep(BATCH_DELAY);
        }
      } catch (error) {
        console.error(`Error processing batch:`, error);
        await sleep(BATCH_DELAY * 2); // Wait longer on error
      }
    }

    console.log(`Successfully fetched ${transactions.length} transactions`);

    // Extract staking transactions (deposits and withdrawals)
    console.log('\nAnalyzing transactions for token transfers...');

    const stakingTransactions: StakingTransaction[] = [];

    for (const tx of transactions) {
      const txResult = processTransaction(
        tx,
        WALLET_ADDRESS,
        STAKING_CONTRACT_ADDRESS,
        TOKEN_MINT_ADDRESS
      );

      if (txResult) {
        stakingTransactions.push(txResult);
      }
    }

    // If a specific transaction was provided, check it directly
    if (CHECK_SPECIFIC_TX) {
      console.log(`\nChecking specific transaction: ${CHECK_SPECIFIC_TX}`);
      try {
        const specificTx = await connection.getParsedTransaction(CHECK_SPECIFIC_TX, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        });

        if (specificTx) {
          const timestamp = specificTx.blockTime
            ? new Date(specificTx.blockTime * 1000)
            : new Date();
          console.log(`Transaction found, date: ${timestamp.toISOString()}`);

          // Process this specific transaction
          const txResult = processTransaction(
            specificTx,
            walletPubkey.toString(),
            stakingContractPubkey.toString(),
            TOKEN_MINT_ADDRESS
          );
          if (txResult) {
            stakingTransactions.push(txResult);
            console.log(
              `Successfully identified as a ${txResult.type} transaction of ${txResult.amount} tokens`
            );
          } else {
            console.log(`Transaction didn't match staking transfer criteria`);
          }
        } else {
          console.log(`Transaction not found or could not be retrieved`);
        }
      } catch (error) {
        console.error(`Error fetching specific transaction:`, error);
      }
    }

    // Sort transactions by timestamp
    stakingTransactions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Display results
    console.log(`\n=== Found ${stakingTransactions.length} staking transactions ===\n`);

    // Format transactions for display
    const formattedTransactions = stakingTransactions.map(tx => ({
      type: tx.type,
      date: tx.timestamp.toISOString().split('T')[0],
      time: tx.timestamp.toISOString().split('T')[1].split('.')[0],
      amount: tx.amount.toFixed(2),
      signature:
        tx.signature.substring(0, 8) + '...' + tx.signature.substring(tx.signature.length - 8),
      fullSignature: tx.signature,
    }));

    console.table(formattedTransactions);

    // Calculate summary statistics
    let totalDeposited = 0;
    let totalWithdrawn = 0;

    stakingTransactions.forEach(tx => {
      if (tx.type === 'deposit') {
        totalDeposited += tx.amount;
      } else if (tx.type === 'withdrawal') {
        totalWithdrawn += tx.amount;
      }
    });

    const netStaked = totalDeposited - totalWithdrawn;

    console.log('\n=== Staking Summary ===');
    console.log(`Total Deposited:  ${totalDeposited.toFixed(2)} tokens`);
    console.log(`Total Withdrawn:  ${totalWithdrawn.toFixed(2)} tokens`);
    console.log(`Net Staked:       ${netStaked.toFixed(2)} tokens`);

    // Track time-based metrics
    const depositsOverTime = new Map<string, number>();
    const withdrawalsOverTime = new Map<string, number>();

    stakingTransactions.forEach(tx => {
      const monthYear = tx.timestamp.toISOString().substring(0, 7); // YYYY-MM format

      if (tx.type === 'deposit') {
        const currentAmount = depositsOverTime.get(monthYear) || 0;
        depositsOverTime.set(monthYear, currentAmount + tx.amount);
      } else if (tx.type === 'withdrawal') {
        const currentAmount = withdrawalsOverTime.get(monthYear) || 0;
        withdrawalsOverTime.set(monthYear, currentAmount + tx.amount);
      }
    });

    // Generate monthly report
    console.log('\n=== Monthly Activity ===');
    console.log('Month      | Deposits | Withdrawals | Net Change');
    console.log('-----------|----------|-------------|----------');

    const allMonths = new Set([...depositsOverTime.keys(), ...withdrawalsOverTime.keys()].sort());

    allMonths.forEach(month => {
      const deposits = depositsOverTime.get(month) || 0;
      const withdrawals = withdrawalsOverTime.get(month) || 0;
      const netChange = deposits - withdrawals;

      console.log(
        `${month}    | ${deposits.toFixed(2).padStart(8)} | ${withdrawals.toFixed(2).padStart(11)} | ${netChange.toFixed(2).padStart(10)}`
      );
    });

    // Verify against expected stake
    console.log('\n=== Verification ===');

    if (stakingTransactions.length > 0) {
      // The staking contract should have received all tokens that weren't withdrawn
      console.log(`Expected in contract (not withdrawn): ${netStaked.toFixed(2)} tokens`);
      console.log(`Total in contract: ${contractBalance.toFixed(2)} tokens`);

      // Provide verification steps for manual checking
      console.log('\nVerification steps:');
      console.log('1. Check if the balance calculation is consistent with transaction history');
      console.log('2. Verify the first and last transactions to ensure completeness');
      console.log('3. Spot check several transactions by their signatures on Solana Explorer');

      // Export transaction list for verification
      console.log('\nFull transaction list for verification:');
      stakingTransactions.forEach((tx, i) => {
        console.log(`${i + 1}. ${tx.type} of ${tx.amount} tokens on ${tx.timestamp.toISOString()}`);
        console.log(`   Signature: ${tx.signature}`);
        console.log(`   Solana Explorer: https://explorer.solana.com/tx/${tx.signature}`);
      });
    } else {
      console.log('No staking transactions found in the specified date range.');
    }
  } catch (error) {
    console.error('Error verifying staking transactions:', error);
  }
}

// Replace the transaction processing with a more comprehensive function
// Add this function before the main loop that processes transactions
function processTransaction(
  tx: ParsedTransactionWithMeta,
  walletAddress: string,
  contractAddress: string,
  tokenMintAddress: string
): StakingTransaction | null {
  if (!tx || tx.meta?.err) return null;

  const timestamp = tx.blockTime ? new Date(tx.blockTime * 1000) : new Date();
  const blockTime = tx.blockTime || 0;
  const slot = tx.slot;

  // Skip transactions outside date range
  if (timestamp < START_DATE || timestamp > END_DATE) return null;

  // Check pre and post token balances
  const preBalances = tx.meta?.preTokenBalances || [];
  const postBalances = tx.meta?.postTokenBalances || [];

  // Maps to track balance changes
  const accountChanges = new Map<
    string,
    {
      owner: string | undefined;
      mint: string;
      preBal: number;
      postBal: number;
      change: number;
    }
  >();

  // Process all balances to identify changes
  for (const balance of preBalances) {
    if (balance.mint !== tokenMintAddress) continue;

    const accountKey = tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString();
    const owner = balance.owner;
    const amount = balance.uiTokenAmount.uiAmount || 0;

    accountChanges.set(accountKey, {
      owner,
      mint: balance.mint,
      preBal: amount,
      postBal: 0, // Will update from post-balances
      change: 0, // Will calculate after
    });
  }

  for (const balance of postBalances) {
    if (balance.mint !== tokenMintAddress) continue;

    const accountKey = tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString();
    const owner = balance.owner;
    const amount = balance.uiTokenAmount.uiAmount || 0;

    if (accountChanges.has(accountKey)) {
      const existing = accountChanges.get(accountKey)!;
      existing.postBal = amount;
      existing.change = amount - existing.preBal;
    } else {
      accountChanges.set(accountKey, {
        owner,
        mint: balance.mint,
        preBal: 0,
        postBal: amount,
        change: amount,
      });
    }
  }

  // Check for contract and wallet involvement
  let isContractInvolved = false;
  let isWalletInvolved = false;
  let contractGained = 0;
  let contractLost = 0;
  let walletGained = 0;
  let walletLost = 0;

  for (const [accountKey, change] of accountChanges.entries()) {
    if (change.owner === contractAddress) {
      isContractInvolved = true;
      if (change.change > 0) {
        contractGained += change.change;
      } else if (change.change < 0) {
        contractLost += Math.abs(change.change);
      }
    } else if (change.owner === walletAddress) {
      isWalletInvolved = true;
      if (change.change > 0) {
        walletGained += change.change;
      } else if (change.change < 0) {
        walletLost += Math.abs(change.change);
      }
    }
  }

  // Only interested in transactions involving both the wallet and contract
  if (!isContractInvolved || !isWalletInvolved) return null;

  // Identify deposits and withdrawals
  if (contractGained > 0 && walletLost > 0 && Math.abs(contractGained - walletLost) < 1) {
    // Wallet lost tokens, contract gained tokens = DEPOSIT
    return {
      type: 'deposit',
      timestamp,
      amount: walletLost, // Use the wallet's lost amount as the transaction amount
      signature: tx.transaction.signatures[0],
      blockTime,
      slot,
    };
  } else if (contractLost > 0 && walletGained > 0 && Math.abs(contractLost - walletGained) < 1) {
    // Contract lost tokens, wallet gained tokens = WITHDRAWAL
    return {
      type: 'withdrawal',
      timestamp,
      amount: walletGained, // Use the wallet's gained amount as the transaction amount
      signature: tx.transaction.signatures[0],
      blockTime,
      slot,
    };
  }

  return null; // Not a valid staking transaction
}

// Run the verification
verifyStakingTransactions();
