# PostgreSQL Database Setup for Solana Playground

This document explains how to set up and configure PostgreSQL with Render.com for your Solana Playground project.

## Setting up PostgreSQL on Render.com

1. Log in to your Render dashboard at https://dashboard.render.com/
2. Navigate to "New" > "PostgreSQL"
3. Configure your PostgreSQL database:
   - **Name**: Choose a name (e.g., "solana-playground-db")
   - **Database**: solana_playground (or your preferred name)
   - **User**: Default is fine
   - **Region**: Choose the region closest to your users
   - **PostgreSQL Version**: 14 or newer
   - **Plan**: Start with Free tier for development, choose a paid plan for production

4. Click "Create Database"

Once the database is created, Render will provide you with:
- Database URL (for connection)
- Internal Database URL (for services in the same Render account)
- Database name
- Username
- Password

## Environment Configuration

Update your .env file with the database connection string:

```
# Solana RPC Settings (existing settings)
SOLANA_RPC_URL=your_rpc_url
SOLANA_API_KEY=your_api_key

# PostgreSQL Connection (new setting)
DATABASE_URL=postgres://username:password@hostname:port/database_name
```

For local development, you can use a local PostgreSQL instance or connect to your Render database remotely.

## Database Initialization and Migration

Run the following commands to initialize the database and migrate data:

```bash
# Install dependencies (if you haven't already)
yarn

# Initialize the database (creates tables)
yarn db:init

# Migrate existing file-based data to PostgreSQL
yarn db:migrate
```

## Connecting Render Web Service

If you're deploying your Solana Playground app on Render:

1. Go to your web service settings
2. Under "Environment", add the environment variable:
   - Key: `DATABASE_URL`
   - Value: Use the "Internal Database URL" from your PostgreSQL service

This allows your application to connect to the database using Render's internal network.

## Tables and Schema

The database includes the following main tables:

1. `social_profiles` - Stores user profile information
2. `wallet_addresses` - Maps wallet addresses to social profiles
3. `nft_snapshots` - Stores NFT snapshot metadata
4. `nft_holders` - Records NFT holders for each snapshot
5. `nfts` - Stores NFT details
6. `token_snapshots` - Stores token snapshot metadata
7. `token_holders` - Records token holders for each snapshot

The complete schema can be found in `schema.sql`.

## Troubleshooting

If you encounter connection issues:

1. Verify your DATABASE_URL is correctly formatted
2. Check if SSL is required (Render PostgreSQL requires SSL in production)
3. Ensure your IP is whitelisted if connecting remotely

For Render-specific database issues, consult the [Render PostgreSQL documentation](https://render.com/docs/databases). 