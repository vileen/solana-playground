/**
 * Script to analyze a specific wallet's staking activity
 */
import { Connection, PublicKey } from '@solana/web3.js';
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

// The staking contract address
const STAKING_CONTRACT_ADDRESS = 'GpUmCRvdKF7EkiufUTCPDvPgy6Fi4GXtrLgLSwLCCyLd';
// The token mint address
const TOKEN_MINT_ADDRESS = '31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk';
// The wallet to analyze
const TARGET_WALLET = 'BEzePHuzfY2njeA6839gVoXQuVd6YvCTGavWjA9KF8ky';

// Define the transaction type
type StakingTransaction = {
  type: 'deposit' | 'withdrawal';
  timestamp: string;
  amount: number;
  signature: string;
  status: string;
};

async function analyzeWalletStaking() {
  try {
    // Create connection to Solana network
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

    // Create connection with API key
    const connectionConfig = {
      commitment: 'confirmed' as const,
      confirmTransactionInitialTimeout: 60000,
    };

    console.log('Creating Solana connection...');
    const connection = new Connection(FULL_RPC_URL, connectionConfig);

    // Get contract and token pubkeys
    const stakingContractPubkey = new PublicKey(STAKING_CONTRACT_ADDRESS);
    const tokenMintPubkey = new PublicKey(TOKEN_MINT_ADDRESS);
    const walletPubkey = new PublicKey(TARGET_WALLET);

    // Fetch the staking contract's token account for this token
    console.log('Finding token accounts for the staking contract...');
    const contractTokenAccounts = await connection.getTokenAccountsByOwner(stakingContractPubkey, {
      mint: tokenMintPubkey,
    });

    if (contractTokenAccounts.value.length === 0) {
      console.log('No token accounts found for this contract and token');
      return;
    }

    const contractTokenAccount = contractTokenAccounts.value[0].pubkey;
    console.log(`Found contract token account: ${contractTokenAccount.toString()}`);

    // Fetch the wallet's token account for this token
    console.log(`Finding token accounts for the wallet ${TARGET_WALLET}...`);
    const walletTokenAccounts = await connection.getTokenAccountsByOwner(walletPubkey, {
      mint: tokenMintPubkey,
    });

    if (walletTokenAccounts.value.length === 0) {
      console.log('No token accounts found for this wallet and token');
      return;
    }

    const walletTokenAccount = walletTokenAccounts.value[0].pubkey;
    console.log(`Found wallet token account: ${walletTokenAccount.toString()}`);

    // Now get all transactions between this wallet and the contract
    console.log('Analyzing transactions...');

    // First, get all transactions for the wallet's token account
    console.log(`Fetching transactions for wallet token account...`);
    const walletTokenSignatures = await connection.getSignaturesForAddress(walletTokenAccount, {
      limit: 100,
    });
    console.log(`Found ${walletTokenSignatures.length} signatures for wallet token account`);

    // Create a map to track all transfers between the wallet and contract
    const transactions: StakingTransaction[] = [];

    // Process signatures in batches to avoid rate limits
    const BATCH_SIZE = 5;
    const BATCH_DELAY = 2000;

    // Helper function to wait
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    console.log('Fetching transaction details...');
    for (let i = 0; i < walletTokenSignatures.length; i += BATCH_SIZE) {
      const batchSignatures = walletTokenSignatures.slice(i, i + BATCH_SIZE);
      console.log(
        `Processing batch ${i / BATCH_SIZE + 1}/${Math.ceil(walletTokenSignatures.length / BATCH_SIZE)}`
      );

      const batchPromises = batchSignatures.map(sig =>
        connection.getParsedTransaction(sig.signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        })
      );

      const batchTransactions = await Promise.all(batchPromises);

      for (const tx of batchTransactions) {
        if (!tx || tx.meta?.err) continue;

        const timestamp = tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : 'unknown';

        // Check for token transfers between wallet and contract
        let isRelevant = false;

        // Check pre and post token balances
        const preBalances = tx.meta?.preTokenBalances || [];
        const postBalances = tx.meta?.postTokenBalances || [];

        // Find contract and wallet accounts in the transaction
        const contractAccounts = new Set<number>();
        const walletAccounts = new Set<number>();

        // Map of account indices to their token accounts
        const accountMap = new Map<number, string>();

        // Identify contract and wallet token accounts in this transaction
        [...preBalances, ...postBalances].forEach(balance => {
          if (balance.mint === TOKEN_MINT_ADDRESS) {
            const accountIndex = balance.accountIndex;
            const accountKey = tx.transaction.message.accountKeys[accountIndex].pubkey.toString();
            accountMap.set(accountIndex, accountKey);

            if (balance.owner === STAKING_CONTRACT_ADDRESS) {
              contractAccounts.add(accountIndex);
            } else if (balance.owner === TARGET_WALLET) {
              walletAccounts.add(accountIndex);
            }
          }
        });

        // Only analyze transactions that involve both the wallet and contract
        if (contractAccounts.size > 0 && walletAccounts.size > 0) {
          isRelevant = true;

          // Look for transfers from wallet to contract (deposits)
          for (const walletAccountIndex of walletAccounts) {
            const walletPreBalance = preBalances.find(b => b.accountIndex === walletAccountIndex);
            const walletPostBalance = postBalances.find(b => b.accountIndex === walletAccountIndex);

            if (walletPreBalance && walletPostBalance) {
              const walletPreAmount = walletPreBalance.uiTokenAmount.uiAmount || 0;
              const walletPostAmount = walletPostBalance.uiTokenAmount.uiAmount || 0;

              // If wallet lost tokens, check if contract gained tokens
              if (walletPreAmount > walletPostAmount) {
                const walletLoss = walletPreAmount - walletPostAmount;

                // Check if contract gained tokens
                for (const contractAccountIndex of contractAccounts) {
                  const contractPreBalance = preBalances.find(
                    b => b.accountIndex === contractAccountIndex
                  );
                  const contractPostBalance = postBalances.find(
                    b => b.accountIndex === contractAccountIndex
                  );

                  if (contractPreBalance && contractPostBalance) {
                    const contractPreAmount = contractPreBalance.uiTokenAmount.uiAmount || 0;
                    const contractPostAmount = contractPostBalance.uiTokenAmount.uiAmount || 0;

                    if (contractPostAmount > contractPreAmount) {
                      const contractGain = contractPostAmount - contractPreAmount;

                      // If the gains and losses approximately match
                      if (Math.abs(contractGain - walletLoss) < 1) {
                        transactions.push({
                          type: 'deposit',
                          timestamp,
                          amount: walletLoss,
                          signature: tx.transaction.signatures[0],
                          status: 'confirmed',
                        });
                      }
                    }
                  }
                }
              }
            }
          }

          // Look for transfers from contract to wallet (withdrawals)
          for (const contractAccountIndex of contractAccounts) {
            const contractPreBalance = preBalances.find(
              b => b.accountIndex === contractAccountIndex
            );
            const contractPostBalance = postBalances.find(
              b => b.accountIndex === contractAccountIndex
            );

            if (contractPreBalance && contractPostBalance) {
              const contractPreAmount = contractPreBalance.uiTokenAmount.uiAmount || 0;
              const contractPostAmount = contractPostBalance.uiTokenAmount.uiAmount || 0;

              // If contract lost tokens, check if wallet gained tokens
              if (contractPreAmount > contractPostAmount) {
                const contractLoss = contractPreAmount - contractPostAmount;

                // Check if wallet gained tokens
                for (const walletAccountIndex of walletAccounts) {
                  const walletPreBalance = preBalances.find(
                    b => b.accountIndex === walletAccountIndex
                  );
                  const walletPostBalance = postBalances.find(
                    b => b.accountIndex === walletAccountIndex
                  );

                  if (walletPreBalance && walletPostBalance) {
                    const walletPreAmount = walletPreBalance.uiTokenAmount.uiAmount || 0;
                    const walletPostAmount = walletPostBalance.uiTokenAmount.uiAmount || 0;

                    if (walletPostAmount > walletPreAmount) {
                      const walletGain = walletPostAmount - walletPreAmount;

                      // If the gains and losses approximately match
                      if (Math.abs(walletGain - contractLoss) < 1) {
                        transactions.push({
                          type: 'withdrawal',
                          timestamp,
                          amount: contractLoss,
                          signature: tx.transaction.signatures[0],
                          status: 'confirmed',
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // If we have more batches to process, wait before the next batch
      if (i + BATCH_SIZE < walletTokenSignatures.length) {
        await sleep(BATCH_DELAY);
      }
    }

    // Sort transactions by timestamp
    transactions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Display the transactions
    console.log(`\nFound ${transactions.length} staking transactions for wallet ${TARGET_WALLET}:`);
    console.table(transactions);

    // Calculate staking balance
    let totalDeposited = 0;
    let totalWithdrawn = 0;

    transactions.forEach(tx => {
      if (tx.type === 'deposit') {
        totalDeposited += tx.amount;
      } else if (tx.type === 'withdrawal') {
        totalWithdrawn += tx.amount;
      }
    });

    const currentlyStaked = totalDeposited - totalWithdrawn;

    console.log(`\nStaking Summary for ${TARGET_WALLET}:`);
    console.log(`Total Deposited: ${totalDeposited}`);
    console.log(`Total Withdrawn: ${totalWithdrawn}`);
    console.log(`Currently Staked: ${currentlyStaked}`);

    // Display the current actual balance in the wallet
    const walletTokenInfo = await connection.getParsedAccountInfo(walletTokenAccount);
    const contractTokenInfo = await connection.getParsedAccountInfo(contractTokenAccount);

    if (walletTokenInfo.value && contractTokenInfo.value) {
      const parsedWalletData = walletTokenInfo.value.data;
      const parsedContractData = contractTokenInfo.value.data;

      if ('parsed' in parsedWalletData && 'parsed' in parsedContractData) {
        const walletBalance = parsedWalletData.parsed.info.tokenAmount.uiAmount;
        const contractBalance = parsedContractData.parsed.info.tokenAmount.uiAmount;

        console.log(`\nCurrent Wallet Balance: ${walletBalance}`);
        console.log(`Current Contract Balance: ${contractBalance}`);
      }
    }
  } catch (error) {
    console.error('Error analyzing wallet staking:', error);
  }
}

// Run the analysis
analyzeWalletStaking();
