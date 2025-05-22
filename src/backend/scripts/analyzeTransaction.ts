/**
 * Script to analyze a specific transaction
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

// The staking contract address
const STAKING_CONTRACT_ADDRESS = 'GpUmCRvdKF7EkiufUTCPDvPgy6Fi4GXtrLgLSwLCCyLd';
// The token mint address
const TOKEN_MINT_ADDRESS = '31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk';

// The transaction to analyze
const TRANSACTION_SIGNATURE =
  '39shBupuPvBvRtsktgPouEDxf2oKaRPUS91Q2U5g18XfompBQKCZVZc1A1r7KF1A1dVcQyquBf6F6Tse2pfzLde8';

async function analyzeTransaction() {
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

    console.log('[Analysis] Creating Solana connection...');
    const connection = new Connection(FULL_RPC_URL, connectionConfig);

    console.log(`[Analysis] Fetching transaction: ${TRANSACTION_SIGNATURE}`);
    const tx = await connection.getParsedTransaction(TRANSACTION_SIGNATURE, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      console.error('[Analysis] Transaction not found');
      return;
    }

    console.log('[Analysis] Transaction details:');
    console.log('Block time:', tx.blockTime);
    console.log('Slot:', tx.slot);
    console.log('Meta error:', tx.meta?.err ? 'Yes' : 'No');

    // Log pre token balances
    console.log('\n[Analysis] Pre-token balances:');
    tx.meta?.preTokenBalances?.forEach((balance, index) => {
      console.log(`Balance ${index}:`);
      console.log(`  Account index: ${balance.accountIndex}`);
      console.log(`  Mint: ${balance.mint}`);
      console.log(`  Owner: ${balance.owner}`);
      console.log(`  UI Amount: ${balance.uiTokenAmount.uiAmount}`);
    });

    // Log post token balances
    console.log('\n[Analysis] Post-token balances:');
    tx.meta?.postTokenBalances?.forEach((balance, index) => {
      console.log(`Balance ${index}:`);
      console.log(`  Account index: ${balance.accountIndex}`);
      console.log(`  Mint: ${balance.mint}`);
      console.log(`  Owner: ${balance.owner}`);
      console.log(`  UI Amount: ${balance.uiTokenAmount.uiAmount}`);
    });

    // Log accounts in the transaction
    console.log('\n[Analysis] Account keys:');
    tx.transaction.message.accountKeys.forEach((account, index) => {
      console.log(
        `Account ${index}: ${account.pubkey.toString()} (Signer: ${account.signer}, Writable: ${account.writable})`
      );
    });

    // Log instructions
    console.log('\n[Analysis] Instructions:');
    tx.transaction.message.instructions.forEach((instruction, index) => {
      console.log(`Instruction ${index}:`);

      // Handle different instruction types
      if ('programId' in instruction) {
        // This is a PartiallyDecodedInstruction
        console.log(`  Program ID: ${instruction.programId.toString()}`);
        console.log(`  Data: ${instruction.data}`);
        console.log(`  Accounts:`, instruction.accounts.map(acc => acc.toString()).join(', '));
      } else if ('program' in instruction) {
        // This is a ParsedInstruction
        console.log(`  Program: ${instruction.program}`);
        if (instruction.parsed) {
          console.log(`  Type: ${instruction.parsed.type}`);
          console.log(`  Info:`, JSON.stringify(instruction.parsed.info, null, 2));
        }
      } else {
        console.log(`  Unknown instruction format:`, instruction);
      }
    });

    // Log whether this should be considered a deposit or withdrawal
    console.log('\n[Analysis] Checking if this is a deposit or withdrawal:');

    // We need to check for token account addresses owned by the staking contract
    console.log('Looking for token accounts owned by staking contract:', STAKING_CONTRACT_ADDRESS);

    // Check for deposits (transfers to the contract's token accounts)
    const isDepositToContract = tx.meta?.postTokenBalances?.some(
      balance => balance.owner === STAKING_CONTRACT_ADDRESS
    );
    console.log('Is deposit to contract:', isDepositToContract);

    // Check for withdrawals (transfers from the contract's token accounts)
    const isWithdrawalFromContract = tx.meta?.preTokenBalances?.some(
      balance => balance.owner === STAKING_CONTRACT_ADDRESS
    );
    console.log('Is withdrawal from contract:', isWithdrawalFromContract);

    // Check if it involves the correct token
    const involvesCorrectToken =
      tx.meta?.preTokenBalances?.some(balance => balance.mint === TOKEN_MINT_ADDRESS) ||
      tx.meta?.postTokenBalances?.some(balance => balance.mint === TOKEN_MINT_ADDRESS);
    console.log('Involves correct token:', involvesCorrectToken);
  } catch (error) {
    console.error('[Analysis] Error:', error);
  }
}

// Run the analysis
analyzeTransaction().catch(console.error);
