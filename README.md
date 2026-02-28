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

## Deployment

This project uses a hybrid architecture:
- **Frontend**: GitHub Pages (free static hosting)
- **Backend + Database**: Local on your machine

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed setup instructions.

Quick start:
```bash
# 1. Start local backend
yarn install
yarn db:init
yarn start

# 2. Deploy frontend (auto via GitHub Actions on push to main)
# Or manually: GITHUB_PAGES=true yarn build
```

## Backend API

- `GET /api/snapshot` - Create a new snapshot
- `GET /api/holders` - Get holders from the latest snapshot
- `POST /api/social-profile` - Save social profile data for a wallet
- `GET /api/social-profiles` - Get wallets with social profiles

## Frontend

- NFT Holders Tab - View all NFT holders
- Token Holders Tab - View all token holders
- Social Profiles Tab - View and manage social mappings
- Staking Tab - Track staking positions and unlock schedules
- Events Tab - View transfer and activity events 