import { getUnlockSummary, loadStakingSnapshot } from '../services/stakingService.js';

async function testDynamicStakingCalculations() {
  console.log('🧪 Testing Dynamic Staking Calculations');
  console.log('=====================================');

  try {
    // Load the latest snapshot
    console.log('\n1. Loading latest staking snapshot...');
    const snapshot = await loadStakingSnapshot();

    if (!snapshot) {
      console.log('❌ No staking snapshot found');
      return;
    }

    console.log(`✅ Loaded snapshot ID: ${snapshot.id}`);
    console.log(`📅 Snapshot timestamp: ${snapshot.timestamp}`);
    console.log(`💰 Total staked: ${snapshot.totalStaked}`);
    console.log(`🔒 Total currently locked: ${snapshot.totalLocked}`);
    console.log(`🔓 Total currently unlocked: ${snapshot.totalUnlocked}`);

    // Show some example wallets with their current status
    console.log('\n2. Sample wallet calculations:');
    const sampleWallets = snapshot.stakingData.slice(0, 3);

    for (const wallet of sampleWallets) {
      console.log(`\n   Wallet: ${wallet.walletAddress}`);
      console.log(`   Total Staked: ${wallet.totalStaked}`);
      console.log(`   Currently Locked: ${wallet.totalLocked}`);
      console.log(`   Currently Unlocked: ${wallet.totalUnlocked}`);

      if (wallet.stakes.length > 0) {
        console.log('   Individual Stakes:');
        wallet.stakes.forEach((stake, index) => {
          const unlockDate = new Date(stake.unlockDate);
          const now = new Date();
          const daysUntilUnlock = Math.ceil(
            (unlockDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          console.log(`     Stake ${index + 1}: ${stake.amount} tokens`);
          console.log(`       Unlock Date: ${unlockDate.toDateString()}`);
          console.log(`       Status: ${stake.isLocked ? '🔒 LOCKED' : '🔓 UNLOCKED'}`);
          if (stake.isLocked && daysUntilUnlock > 0) {
            console.log(`       Days until unlock: ${daysUntilUnlock}`);
          } else if (stake.isLocked && daysUntilUnlock <= 0) {
            console.log(
              `       ⚠️  Should be unlocked (${Math.abs(daysUntilUnlock)} days overdue)`
            );
          }
        });
      }
    }

    // Test unlock summary
    console.log('\n3. Testing unlock summary...');
    const unlockSummary = await getUnlockSummary();

    if (unlockSummary.length > 0) {
      console.log(`✅ Found ${unlockSummary.length} future unlock dates:`);
      unlockSummary.forEach(unlock => {
        console.log(`   📅 ${unlock.date}: ${unlock.amount} tokens`);
      });
    } else {
      console.log('ℹ️  No future unlocks found (all tokens may already be unlocked)');
    }

    // Test with a specific wallet
    if (sampleWallets.length > 0) {
      console.log('\n4. Testing wallet-specific unlock summary...');
      const testWallet = sampleWallets[0].walletAddress;
      const walletUnlocks = await getUnlockSummary(undefined, testWallet);

      if (walletUnlocks.length > 0) {
        console.log(`✅ Found ${walletUnlocks.length} future unlocks for ${testWallet}:`);
        walletUnlocks.forEach(unlock => {
          console.log(`   📅 ${unlock.date}: ${unlock.amount} tokens`);
        });
      } else {
        console.log(`ℹ️  No future unlocks found for wallet ${testWallet}`);
      }
    }

    console.log('\n✅ Dynamic staking calculation test completed successfully!');
  } catch (error) {
    console.error('❌ Error testing dynamic staking calculations:', error);
  }
}

// Run the test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDynamicStakingCalculations()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}
