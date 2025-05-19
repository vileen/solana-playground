# Legacy Files

This directory contains files that are no longer actively used in the application but are kept for reference.

## Migration Scripts

- `migrate-files-to-db.ts` - Script used to migrate data from JSON files to PostgreSQL database
- `migrateToDatabase.ts` - Earlier version of database migration script
- `alter-table.js` - One-time script used to alter the wallet_addresses table to increase column size

## File-based Services (Replaced by Database Services)

These services were used when the application stored data in JSON files. They have been replaced by database-backed equivalents:

- `socialProfiles.ts` - Replaced by `socialProfilesDb.ts`
- `tokenService.ts` - Replaced by `tokenServiceDb.ts`
- `nftCollections.ts` - Replaced by `nftCollectionsDb.ts`

These files are kept for reference only and should not be imported or used in active code. 