# Solana NFT Snapshot Tool

A tool for fetching NFT holders from a Solana collection and creating snapshots with social mapping capabilities.

## Features

- Fetch NFTs by update authority
- Filter NFTs by name pattern
- Create and save holder snapshots
- Map social profiles (Twitter and Discord) to wallet addresses
- Interactive UI for viewing and managing data

## Project Structure

```
solana-snapshot-tool/
├── data/              # Snapshot data storage
├── src/
│   ├── backend/       # Express backend server
│   ├── frontend/      # React frontend
│   └── types/         # TypeScript type definitions
├── .env               # Environment variables
├── package.json       # Project dependencies
└── README.md          # This file
```

## Getting Started

1. Set up environment variables:
   ```
   HELIUS_RPC_URL=https://your-helius-rpc-endpoint.com
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Run the development server:
   ```
   npm run dev
   ```

## Backend API

- `GET /api/snapshot` - Create a new snapshot
- `GET /api/holders` - Get holders from the latest snapshot
- `POST /api/social-profile` - Save social profile data for a wallet
- `GET /api/social-profiles` - Get wallets with social profiles

## Frontend

- NFT Holders Tab - View all NFT holders
- Social Profiles Tab - View and manage social mappings 