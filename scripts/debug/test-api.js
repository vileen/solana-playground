// Simple test script to test our API endpoints directly

import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:3001/api';

async function testSocialProfilesEndpoint() {
  try {
    // Sample profile data
    const profileData = {
      twitter: "@testuser",
      discord: "testuser#1234",
      comment: "Test user profile",
      wallets: [
        { address: "DYw8jMTrZqxWL2fNBk2CsMvGaT19GvwrwNvq9wKqsQaX" }
      ]
    };

    console.log('Testing POST to /social-profiles with data:', JSON.stringify(profileData, null, 2));

    const response = await fetch(`${API_BASE_URL}/social-profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileData),
    });

    const responseData = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', responseData);
  } catch (error) {
    console.error('Error testing social profiles endpoint:', error);
  }
}

async function testGetSocialProfiles() {
  try {
    console.log('Testing GET to /social-profiles');
    
    const response = await fetch(`${API_BASE_URL}/social-profiles`);
    
    const profiles = await response.json();
    console.log('Response status:', response.status);
    console.log('Number of profiles:', profiles.length);
    console.log('First few profiles:', profiles.slice(0, 2));
  } catch (error) {
    console.error('Error fetching social profiles:', error);
  }
}

// Run the tests
async function runTests() {
  console.log('=== Testing Social Profiles API ===');
  await testSocialProfilesEndpoint();
  console.log('\n=== Testing Get Social Profiles API ===');
  await testGetSocialProfiles();
}

runTests(); 