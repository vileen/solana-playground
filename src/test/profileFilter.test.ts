/**
 * Test for profile filter logic in TokenInfo
 * Run: npx tsx src/test/profileFilter.test.ts
 */

interface SocialProfile {
  id: string;
  twitter?: string;
  discord?: string;
  comment?: string;
  displayName?: string;
}

// Copy of filter logic from TokenInfo.tsx
function filterProfiles(profiles: SocialProfile[], profileFilter: string): SocialProfile[] {
  return profiles.filter(p => {
    if (!profileFilter) return true;
    const search = profileFilter.toLowerCase();
    return (
      (p.displayName && p.displayName.toLowerCase().includes(search)) ||
      (p.twitter && p.twitter.toLowerCase().includes(search)) ||
      (p.discord && p.discord.toLowerCase().includes(search)) ||
      (p.comment && p.comment.toLowerCase().includes(search))
    );
  });
}

// Test data
const testProfiles: SocialProfile[] = [
  { id: '1', twitter: '@johndoe', discord: 'john#1234', displayName: '@johndoe' },
  { id: '2', discord: 'jane#5678', displayName: 'jane#5678' },
  { id: '3', comment: 'Team Wallet', displayName: 'Team Wallet' },
  { id: '4', twitter: '@admin', discord: 'admin#0001', comment: 'Treasury', displayName: '@admin' },
  { id: '5', displayName: 'Unknown' },
];

// Tests
console.log('Running profile filter tests...\n');

// Test 1: No filter returns all
const result1 = filterProfiles(testProfiles, '');
console.log(`Test 1 - No filter: ${result1.length === 5 ? 'PASS' : 'FAIL'} (expected 5, got ${result1.length})`);

// Test 2: Filter by twitter
const result2 = filterProfiles(testProfiles, 'john');
console.log(`Test 2 - Filter 'john': ${result2.length === 1 && result2[0]?.id === '1' ? 'PASS' : 'FAIL'} (expected 1, got ${result2.length})`);

// Test 3: Filter by discord
const result3 = filterProfiles(testProfiles, 'jane');
console.log(`Test 3 - Filter 'jane': ${result3.length === 1 && result3[0]?.id === '2' ? 'PASS' : 'FAIL'} (expected 1, got ${result3.length})`);

// Test 4: Filter by comment
const result4 = filterProfiles(testProfiles, 'team');
console.log(`Test 4 - Filter 'team': ${result4.length === 1 && result4[0]?.id === '3' ? 'PASS' : 'FAIL'} (expected 1, got ${result4.length})`);

// Test 5: Case insensitive
const result5 = filterProfiles(testProfiles, 'JOHN');
console.log(`Test 5 - Filter 'JOHN' (case insensitive): ${result5.length === 1 ? 'PASS' : 'FAIL'} (expected 1, got ${result5.length})`);

// Test 6: Partial match
const result6 = filterProfiles(testProfiles, 'adm');
console.log(`Test 6 - Filter 'adm': ${result6.length === 1 && result6[0]?.id === '4' ? 'PASS' : 'FAIL'} (expected 1, got ${result6.length})`);

// Test 7: No match
const result7 = filterProfiles(testProfiles, 'nonexistent');
console.log(`Test 7 - Filter 'nonexistent': ${result7.length === 0 ? 'PASS' : 'FAIL'} (expected 0, got ${result7.length})`);

// Test 8: Match by displayName
const result8 = filterProfiles(testProfiles, 'unknown');
console.log(`Test 8 - Filter 'unknown': ${result8.length === 1 && result8[0]?.id === '5' ? 'PASS' : 'FAIL'} (expected 1, got ${result8.length})`);

console.log('\nAll tests completed.');
