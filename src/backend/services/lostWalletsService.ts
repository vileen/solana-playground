import { query, withTransaction } from '../db/index.js';

export interface LostWallet {
  id: number;
  wallet_address: string;
  social_id: string | null;
  reason: string | null;
  lost_amount: number | null;
  lost_at: string;
  recovered_at: string | null;
  is_lost: boolean;
  twitter?: string | null;
  discord?: string | null;
  comment?: string | null;
}

/**
 * Get all lost wallets with optional social profile data
 */
export async function getLostWallets(): Promise<LostWallet[]> {
  try {
    const result = await query(`
      SELECT 
        lw.*,
        sp.twitter,
        sp.discord,
        sp.comment
      FROM lost_wallets lw
      LEFT JOIN social_profiles sp ON lw.social_id = sp.id
      WHERE lw.is_lost = TRUE
      ORDER BY lw.lost_at DESC
    `);

    return result.rows.map(row => ({
      id: row.id,
      wallet_address: row.wallet_address,
      social_id: row.social_id,
      reason: row.reason,
      lost_amount: row.lost_amount ? parseFloat(row.lost_amount) : null,
      lost_at: row.lost_at,
      recovered_at: row.recovered_at,
      is_lost: row.is_lost,
      twitter: row.twitter,
      discord: row.discord,
      comment: row.comment,
    }));
  } catch (error) {
    console.error('Error getting lost wallets:', error);
    return [];
  }
}

/**
 * Mark a wallet as lost
 */
export async function markWalletAsLost(
  walletAddress: string,
  reason?: string,
  lostAmount?: number
): Promise<boolean> {
  try {
    return await withTransaction(async (client) => {
      // Get social_id if wallet has a profile
      const walletResult = await client.query(
        'SELECT social_id FROM wallet_addresses WHERE address = $1',
        [walletAddress]
      );

      const socialId = walletResult.rowCount > 0 ? walletResult.rows[0].social_id : null;

      // Get wallet balance from latest token snapshot if not provided
      let amount = lostAmount;
      if (!amount) {
        const balanceResult = await client.query(`
          SELECT COALESCE(th.balance, 0) as balance
          FROM token_holders th
          JOIN token_snapshots ts ON th.snapshot_id = ts.id
          WHERE th.address = $1
          ORDER BY ts.timestamp DESC
          LIMIT 1
        `, [walletAddress]);
        
        amount = balanceResult.rowCount > 0 ? parseFloat(balanceResult.rows[0].balance) : 0;

        // If no token balance, check staking
        if (amount === 0) {
          const stakingResult = await client.query(`
            SELECT COALESCE(swd.total_staked, 0) as staked
            FROM staking_wallet_data swd
            JOIN staking_snapshots ss ON swd.snapshot_id = ss.id
            WHERE swd.wallet_address = $1
            ORDER BY ss.timestamp DESC
            LIMIT 1
          `, [walletAddress]);
          
          amount = stakingResult.rowCount > 0 ? parseFloat(stakingResult.rows[0].staked) : 0;
        }
      }

      // Insert or update lost wallet
      await client.query(`
        INSERT INTO lost_wallets (wallet_address, social_id, reason, lost_amount, is_lost)
        VALUES ($1, $2, $3, $4, TRUE)
        ON CONFLICT (wallet_address) 
        DO UPDATE SET
          is_lost = TRUE,
          reason = COALESCE($3, lost_wallets.reason),
          lost_amount = COALESCE($4, lost_wallets.lost_amount),
          recovered_at = NULL
      `, [walletAddress, socialId, reason || null, amount]);

      // Mark in token_holders
      await client.query(
        'UPDATE token_holders SET is_lost = TRUE WHERE address = $1',
        [walletAddress]
      );

      // Mark in staking_wallet_data
      await client.query(
        'UPDATE staking_wallet_data SET is_lost = TRUE WHERE wallet_address = $1',
        [walletAddress]
      );

      // Mark in staking_stakes
      await client.query(
        'UPDATE staking_stakes SET is_lost = TRUE WHERE wallet_address = $1',
        [walletAddress]
      );

      console.log(`[Lost Wallets] Marked ${walletAddress} as lost (amount: ${amount})`);
      return true;
    });
  } catch (error) {
    console.error('Error marking wallet as lost:', error);
    return false;
  }
}

/**
 * Recover a wallet (mark as not lost)
 */
export async function recoverWallet(walletAddress: string): Promise<boolean> {
  try {
    return await withTransaction(async (client) => {
      await client.query(`
        UPDATE lost_wallets 
        SET is_lost = FALSE, recovered_at = CURRENT_TIMESTAMP
        WHERE wallet_address = $1
      `, [walletAddress]);

      await client.query(
        'UPDATE token_holders SET is_lost = FALSE WHERE address = $1',
        [walletAddress]
      );

      await client.query(
        'UPDATE staking_wallet_data SET is_lost = FALSE WHERE wallet_address = $1',
        [walletAddress]
      );

      await client.query(
        'UPDATE staking_stakes SET is_lost = FALSE WHERE wallet_address = $1',
        [walletAddress]
      );

      console.log(`[Lost Wallets] Recovered ${walletAddress}`);
      return true;
    });
  } catch (error) {
    console.error('Error recovering wallet:', error);
    return false;
  }
}

/**
 * Get total lost token amount from latest snapshot
 */
export async function getTotalLostTokens(): Promise<number> {
  try {
    const result = await query(`
      SELECT COALESCE(SUM(th.balance), 0) as total_lost
      FROM token_holders th
      JOIN token_snapshots ts ON th.snapshot_id = ts.id
      WHERE th.is_lost = TRUE
        AND ts.id = (SELECT MAX(id) FROM token_snapshots)
    `);

    return parseFloat(result.rows[0].total_lost) || 0;
  } catch (error) {
    console.error('Error getting total lost tokens:', error);
    return 0;
  }
}

/**
 * Get total lost staked amount from latest snapshot
 */
export async function getTotalLostStaked(): Promise<number> {
  try {
    const result = await query(`
      SELECT COALESCE(SUM(swd.total_staked), 0) as total_lost_staked
      FROM staking_wallet_data swd
      JOIN staking_snapshots ss ON swd.snapshot_id = ss.id
      WHERE swd.is_lost = TRUE
        AND ss.id = (SELECT MAX(id) FROM staking_snapshots)
    `);

    return parseFloat(result.rows[0].total_lost_staked) || 0;
  } catch (error) {
    console.error('Error getting total lost staked:', error);
    return 0;
  }
}

/**
 * Get token info for real mcap calculation
 * Returns: FDV, lost tokens, excluded profiles tokens, real mcap
 */
export async function getTokenInfo(excludeSocialIds?: string[]): Promise<{
  totalSupply: number;
  lostTokens: number;
  lostStaked: number;
  excludedTokens: number;
  excludedStaked: number;
  realCirculating: number;
  realMcap: number;
}> {
  try {
    // Get latest token snapshot
    const tokenResult = await query(`
      SELECT ts.total_supply, ts.id as snapshot_id
      FROM token_snapshots ts
      ORDER BY ts.timestamp DESC
      LIMIT 1
    `);

    if (tokenResult.rowCount === 0) {
      return {
        totalSupply: 0,
        lostTokens: 0,
        lostStaked: 0,
        excludedTokens: 0,
        excludedStaked: 0,
        realCirculating: 0,
        realMcap: 0,
      };
    }

    const totalSupply = parseFloat(tokenResult.rows[0].total_supply);
    const snapshotId = tokenResult.rows[0].snapshot_id;

    // Get lost tokens from token_holders
    const lostTokensResult = await query(`
      SELECT COALESCE(SUM(balance), 0) as total
      FROM token_holders
      WHERE snapshot_id = $1 AND is_lost = TRUE
    `, [snapshotId]);

    const lostTokens = parseFloat(lostTokensResult.rows[0].total) || 0;

    // Get lost staked from staking_wallet_data
    const lostStakedResult = await query(`
      SELECT COALESCE(SUM(swd.total_staked), 0) as total
      FROM staking_wallet_data swd
      JOIN staking_snapshots ss ON swd.snapshot_id = ss.id
      WHERE swd.is_lost = TRUE
        AND ss.id = (SELECT MAX(id) FROM staking_snapshots)
    `);

    const lostStaked = parseFloat(lostStakedResult.rows[0].total) || 0;

    // Get excluded profile tokens if social IDs provided
    let excludedTokens = 0;
    let excludedStaked = 0;

    if (excludeSocialIds && excludeSocialIds.length > 0) {
      const excludedTokensResult = await query(`
        SELECT COALESCE(SUM(th.balance), 0) as total
        FROM token_holders th
        JOIN wallet_addresses wa ON th.address = wa.address
        WHERE th.snapshot_id = $1 
          AND wa.social_id = ANY($2)
          AND th.is_lost = FALSE
      `, [snapshotId, excludeSocialIds]);

      excludedTokens = parseFloat(excludedTokensResult.rows[0].total) || 0;

      const excludedStakedResult = await query(`
        SELECT COALESCE(SUM(swd.total_staked), 0) as total
        FROM staking_wallet_data swd
        JOIN wallet_addresses wa ON swd.wallet_address = wa.address
        JOIN staking_snapshots ss ON swd.snapshot_id = ss.id
        WHERE wa.social_id = ANY($1)
          AND swd.is_lost = FALSE
          AND ss.id = (SELECT MAX(id) FROM staking_snapshots)
      `, [excludeSocialIds]);

      excludedStaked = parseFloat(excludedStakedResult.rows[0].total) || 0;
    }

    // Calculate real circulating (excluding lost and excluded profiles)
    // Include both token balance and staked amounts
    const totalLost = lostTokens + lostStaked;
    const totalExcluded = excludedTokens + excludedStaked;
    const realCirculating = totalSupply - totalLost - totalExcluded;
    
    // For mcap, we typically use circulating supply, not total
    // But user wants: FDV - lost - excluded = real mcap basis
    const realMcap = realCirculating;

    return {
      totalSupply,
      lostTokens: totalLost,  // Combined lost (tokens + staked)
      lostStaked,
      excludedTokens: totalExcluded,  // Combined excluded (tokens + staked)
      excludedStaked,
      realCirculating,
      realMcap,
    };
  } catch (error) {
    console.error('Error getting token info:', error);
    return {
      totalSupply: 0,
      lostTokens: 0,
      lostStaked: 0,
      excludedTokens: 0,
      excludedStaked: 0,
      realCirculating: 0,
      realMcap: 0,
    };
  }
}
