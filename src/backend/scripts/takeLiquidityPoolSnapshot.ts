/**
 * Script to take a liquidity pool snapshot
 * This builds on previous snapshots to minimize processing time
 */
import { config as dotenvConfig } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { analyzeLiquidityPoolsTransactions } from '../services/liquidityPoolService.js';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../../');

// Load environment variables from .env.local
console.log('Loading environment variables from .env.local');
dotenvConfig({ path: join(rootDir, '.env.local') });

async function main() {
  try {
    console.log(
      'Starting liquidity pool analysis - this may take several hours for the first run...'
    );

    // Get command line arguments
    const args = process.argv.slice(2);
    const fullRefreshArg = args.find(arg => arg === '--full-refresh');

    if (fullRefreshArg) {
      console.log(
        'WARNING: --full-refresh flag detected. Will perform a full liquidity pool analysis!'
      );
    }

    // Run the analysis
    const analysis = await analyzeLiquidityPoolsTransactions();

    console.log(`Successfully completed liquidity pool analysis!`);
    console.log(
      `Total tokens across platforms: ${analysis.totalAnalysis.totalTokensAcrossPlatforms}`
    );
    console.log(`Total inflows: ${analysis.totalAnalysis.totalInflows}`);
    console.log(`Total outflows: ${analysis.totalAnalysis.totalOutflows}`);
    console.log(`Number of contributors: ${analysis.totalAnalysis.totalUniqueWallets}`);

    // Exit gracefully
    process.exit(0);
  } catch (error) {
    console.error('Error analyzing liquidity pools:', error);
    process.exit(1);
  }
}

// Run the script
main();
