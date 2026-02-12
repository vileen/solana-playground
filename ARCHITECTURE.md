# Solana Playground — Architecture Reference

> Taiyo jeet tracking — Full-stack Solana NFT/Token holder tracking application

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, PrimeReact, PrimeFlex, react-router-dom v7, Chart.js |
| Backend | Express 4, TypeScript, Node.js |
| Database | PostgreSQL (via `pg`) |
| Blockchain | @solana/web3.js, @metaplex-foundation/js, Metaplex UMI |
| External APIs | BitQuery (liquidity pool analysis) |
| Build | Vite, TSC, tsx (dev server) |
| Package Manager | Yarn |
| Deployment | Render (render.yaml, Procfile) |
| Formatting | Prettier with import sorting |

---

## Project Structure

```
solana-playground/
├── src/
│   ├── frontend/               # React SPA
│   │   ├── App.tsx             # Root: BrowserRouter + TabView (6 tabs)
│   │   ├── App.css             # Global styles
│   │   ├── AppContext.tsx       # React Context+Reducer (largely unused)
│   │   ├── main.tsx            # Vite entry point
│   │   ├── components/         # UI Components
│   │   │   ├── SearchBar.tsx           # Debounced URL-driven search input
│   │   │   ├── NftHolders.tsx          # NFT holder table with snapshots
│   │   │   ├── TokenHolders.tsx        # Token holder table with snapshots
│   │   │   ├── SocialProfiles.tsx      # Grouped social profiles view
│   │   │   ├── StakingView.tsx         # Staking data + unlock schedule chart
│   │   │   ├── EventsPanel.tsx         # Snapshot-based event viewer
│   │   │   ├── CombinedSnapshotsPanel.tsx  # Timeline view across snapshots
│   │   │   ├── ProfileDialog.tsx       # Add/Edit social profiles dialog
│   │   │   ├── WalletAddress.tsx       # Reusable wallet display (copy/link)
│   │   │   ├── SocialPillX.tsx         # Twitter/X pill display
│   │   │   ├── SocialPillDiscord.tsx   # Discord pill display
│   │   │   ├── SocialPillComment.tsx   # Comment pill display
│   │   │   ├── XIcon.tsx              # X/Twitter SVG icon
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   └── useAppNavigation.ts     # Memoized tab navigation + URL params
│   │   ├── services/
│   │   │   └── api.js                  # All API calls (with AbortSignal support)
│   │   └── utils/
│   │       ├── theme.ts               # Dark/light mode toggle
│   │       ├── addressUtils.ts        # Wallet address truncation
│   │       └── formatting.ts          # Date/number formatting
│   │
│   ├── backend/                # Express API server
│   │   ├── server.ts           # Entry point: CORS, routes, static SPA serving
│   │   ├── config/
│   │   │   ├── config.ts       # TOKEN_ADDRESS, COLLECTION_ADDRESSES, RPC_URL, PORT
│   │   │   └── env.ts          # dotenv loader, ENV object
│   │   ├── db/
│   │   │   ├── index.ts        # PostgreSQL pool + query helper
│   │   │   ├── initDb.ts       # Database initialization
│   │   │   ├── schema.sql      # Full DB schema
│   │   │   └── migrations/     # SQL + TS migration scripts
│   │   ├── routes/
│   │   │   ├── api.ts          # Main API routes (holders, snapshots, social, events, LP)
│   │   │   ├── events.ts       # Event-specific routes
│   │   │   └── stakingRoutes.ts # Staking endpoints
│   │   ├── services/
│   │   │   ├── nftCollectionsDb.ts     # NFT holder queries + snapshots
│   │   │   ├── tokenServiceDb.ts       # Token holder queries + snapshots
│   │   │   ├── socialProfilesDb.ts     # Social profile CRUD
│   │   │   ├── stakingService.ts       # Staking data + unlock summary
│   │   │   ├── eventsService.ts        # Token/NFT event queries
│   │   │   └── liquidityPoolService.ts # LP analysis (BitQuery + RPC)
│   │   ├── scripts/            # ~24 CLI utility scripts
│   │   └── legacy/             # Deprecated file-based storage
│   │
│   └── types/
│       └── index.ts            # Shared TypeScript interfaces
│
├── package.json                # Scripts, dependencies
├── vite.config.ts              # Vite build config
├── tsconfig.json               # TypeScript config
├── render.yaml                 # Render deployment config
└── startup.sh                  # Production start script
```

---

## Frontend Architecture

### Tab Structure (App.tsx)

| Index | Tab | Route | Component |
|-------|-----|-------|-----------|
| 0 | NFT Holders | `/nft-holders` | `NftHolders` |
| 1 | Token Holders | `/token-holders` | `TokenHolders` |
| 2 | Events | `/events` | `EventsPanel` |
| 3 | Events Timeline | `/timeline` | `CombinedSnapshotsPanel` |
| 4 | Staking | `/staking` | `StakingView` |
| 5 | Social Profiles | `/social-profiles` | `SocialProfiles` |

### Search Architecture (URL as Single Source of Truth)

All search state flows through the `?search=` URL query parameter:

```
User types → SearchBar (local inputValue for responsiveness)
           → debounce 300ms
           → setSearchParams({ search: value })  (updates URL)
           → useSearchParams() in each component reads new value
           → useEffect([searchTerm, selectedSnapshotId]) triggers data fetch
```

**Key design decisions:**
- `SearchBar` only writes to the URL via `useSearchParams().setSearchParams()` — no parent callbacks
- All data components read from URL via `useSearchParams().get('search')`
- No `sharedSearchTerm` in App.tsx, no `localSearchTerm` in components
- Search persists across tab switches via `navigateToTab({ preserveSearch: true })`

### Navigation (useAppNavigation hook)

Fully memoized with `useCallback` + `useMemo` — safe for dependency arrays:
- `navigateToTab(index)` — switch tabs, preserving search by default
- `navigateToNftHolders(searchTerm?)` — deep link to NFT tab with search
- `navigateToTokenHolders(searchTerm?)` — deep link to Token tab with search
- `updateSearchParam(searchTerm)` — update URL search on current page
- `getCurrentTabIndex()` — derive tab index from URL pathname

### Request Cancellation (AbortController)

All data-fetching `useEffect` hooks create an `AbortController` and abort on cleanup:

```tsx
useEffect(() => {
  const abortController = new AbortController();
  fetchData(searchTerm, abortController.signal);
  return () => abortController.abort();
}, [searchTerm, selectedSnapshotId]);
```

API functions in `api.js` accept `{ signal }` as the last options parameter and pass it to `fetch()`. `AbortError` is silently caught.

### State Management

- **No global state store** — `AppContext.tsx` exists but is unused by most components
- Each component manages its own data state (`holders`, `loading`, `snapshots`, etc.)
- Parent `App.tsx` only manages: `activeTab`, `profileDialogVisible`, `selectedHolder`, `isDarkMode`
- Child components expose methods via `forwardRef` + `useImperativeHandle` for parent-triggered refreshes

---

## Backend Architecture

### Server (server.ts)

Express app serving:
1. `/api` — Main API routes (api.ts)
2. `/api/events` — Event routes (events.ts)
3. `/api` — Staking routes (stakingRoutes.ts)
4. Static SPA files from `dist/`

CORS enabled for development. JSON body parsing.

### API Endpoints

#### NFT Holders (`/api`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/holders` | Get NFT holders (optional `?search=`, `?snapshotId=`) |
| GET | `/snapshot` | Take a new NFT snapshot |
| GET | `/nft/snapshots` | List NFT snapshots (optional `?limit=`) |
| GET | `/nft-events/latest` | Latest NFT events |
| GET | `/nft-events/:id` | NFT events for a snapshot |

#### Token Holders (`/api`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/token-holders` | Get token holders (optional `?search=`, `?snapshotId=`) |
| GET | `/token-snapshot` | Take a new token snapshot |
| GET | `/token-snapshots` | List token snapshots (optional `?limit=`) |
| GET | `/token-events/latest` | Latest token events |
| GET | `/token-events/:id` | Token events for a snapshot |

#### Social Profiles (`/api`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/social-profiles` | List all profiles (optional `?search=`) |
| POST | `/social-profile` | Save single profile (legacy) |
| POST | `/social-profiles` | Save profile with multiple wallets |
| DELETE | `/social-profiles/:id` | Delete a profile |
| GET | `/summary` | Summary statistics |

#### Staking (`/api`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/staking` | Get staking data (optional `?search=`, `?snapshotId=`) |
| POST | `/staking-snapshot` | Take a new staking snapshot |
| GET | `/staking-snapshots` | List staking snapshots |
| GET | `/staking-snapshot/:id` | Get specific staking snapshot |
| GET | `/staking-unlock-summary` | Future unlock schedule (optional `?snapshotId=`, `?walletAddress=`) |

#### Events (`/api/events`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/token/snapshots` | Token snapshots with events (`?limit=`, `?skip=`) |
| GET | `/nft/snapshots` | NFT snapshots with events (`?limit=`, `?skip=`) |

#### Liquidity Pools (`/api`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/liquidity-pools/analysis` | Full LP analysis |
| GET | `/liquidity-pools/platform/:platform` | Per-platform analysis |
| GET | `/liquidity-pools/platforms` | All platforms summary |
| GET | `/liquidity-pools/transactions` | LP transaction analysis |
| GET | `/liquidity-pools/transactions-bitquery` | LP analysis via BitQuery |
| GET | `/liquidity-pools/search/:walletAddress` | Search wallet in LPs |
| GET | `/liquidity-pools/search-direct/:walletAddress` | Direct wallet LP search |
| GET | `/liquidity-pools/diagnostic` | BitQuery diagnostics |

### Services Layer

| Service | Purpose |
|---------|---------|
| `nftCollectionsDb.ts` | `getHolders(search, snapshotId)`, `createHolderSnapshot()`, `loadHolderSnapshot(id)` |
| `tokenServiceDb.ts` | `getFilteredTokenHolders(search, snapshotId)`, `createTokenSnapshot()` |
| `socialProfilesDb.ts` | `loadSocialProfiles()`, `saveSocialProfile(data)`, `deleteSocialProfile(id)` |
| `stakingService.ts` | `getFilteredStakingData(search, limit, snapshotId)`, `createStakingSnapshot()`, `getUnlockSummary(snapshotId, wallet)` |
| `eventsService.ts` | `getTokenEventsForSnapshot(id)`, `getNFTEventsForSnapshot(id)`, snapshot event queries |
| `liquidityPoolService.ts` | BitQuery + RPC based LP analysis for Orca, Raydium, Meteora |

---

## Database Schema

PostgreSQL tables:

```
social_profiles (id PK, twitter, discord, comment, updated_at)
  └── wallet_addresses (address PK, social_id FK → social_profiles)

nft_snapshots (id SERIAL PK, timestamp, total_count)
  ├── nft_holders (snapshot_id+address PK, nft_count, gen1_count, infant_count)
  └── nft_ownership (snapshot_id+mint PK, owner_address)
       └── nfts (mint PK, name, type: Gen1|Infant)

token_snapshots (id SERIAL PK, timestamp, token_address, total_supply)
  └── token_holders (snapshot_id+address PK, balance, is_lp_pool, is_treasury)

token_distributions (id SERIAL PK, holder_address, amount, status, transaction_id)

event_types (id SERIAL PK, name UNIQUE, description)
  ├── token_events (id SERIAL PK, snapshot_id, event_type_id, source/dest address, amount, balances, social_id)
  └── nft_events (id SERIAL PK, snapshot_id, event_type_id, mint, source/dest address, social_id)
```

Default event types: `new_holder`, `transfer_in`, `transfer_out`, `transfer_between`, `wallet_empty`

---

## Shared Types (src/types/index.ts)

| Type | Key Fields |
|------|------------|
| `NFTHolder` | address, nftCount, gen1Count, infantCount, nfts[], twitter?, discord?, comment?, id? |
| `TokenHolder` | address, balance, isLpPool?, isTreasury?, twitter?, discord?, comment?, id? |
| `Stake` | amount, stakeDate, unlockDate, isLocked, mintAddress |
| `StakeData` | walletAddress, totalStaked, totalLocked, totalUnlocked, stakes[] |
| `StakingSnapshot` | id?, contractAddress, timestamp, totals, lastSignature?, isIncremental?, stakingData[] |
| `TokenSnapshot` | id?, tokenAddress, timestamp, holders[], totalSupply |
| `CollectionSnapshot` | holders[], timestamp, total |
| `TokenEvent` | id, event_type, source/dest address, amount, balances, social info |
| `NFTEvent` | id, event_type, mint, nft_name, nft_type, source/dest, social info |
| `LiquidityPoolsAnalysis` | orca[], raydium[], meteora[], totalAnalysis |

---

## Configuration

### Environment Variables (.env / .env.local)
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SOLANA_RPC_URL` | Solana RPC endpoint |
| `SOLANA_API_KEY` | RPC API key (appended to URL) |
| `BITQUERY_API_KEY` | BitQuery API key |
| `BITQUERY_ACCESS_TOKEN` | BitQuery bearer token |
| `NODE_ENV` | production / development |
| `PORT` | Server port (default: 3001) |

### Key Constants (config/config.ts)
| Constant | Value |
|----------|-------|
| `TOKEN_ADDRESS` | `31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk` |
| `COLLECTION_ADDRESSES` | 2 NFT collection addresses |
| `PORT` | `process.env.PORT \|\| 3001` |

---

## Scripts (package.json)

| Script | Purpose |
|--------|---------|
| `dev` | Run backend + frontend concurrently |
| `build` | TSC + Vite build |
| `start` | Production startup via startup.sh |
| `db:init` | Initialize database tables |
| `db:migrate` | Migrate file-based data to PostgreSQL |
| `staking:take-snapshot` | Take staking snapshot from CLI |
| `nft:take-snapshot` | Take NFT snapshot from CLI |
| `search:transaction` | Search for a specific transaction |
| `verify:*` / `debug:*` / `audit:*` | Various debugging/verification scripts |

---

## Data Flow

### Snapshot Lifecycle
1. **Take snapshot** → Backend reads on-chain data (RPC) → stores in PostgreSQL
2. **View snapshot** → Frontend fetches from API with optional snapshotId
3. **Compare snapshots** → Events are generated by comparing consecutive snapshots
4. **Events** → Displayed in EventsPanel and CombinedSnapshotsPanel

### Social Profile Lifecycle
1. **Create** → ProfileDialog → POST `/api/social-profiles` → saves to `social_profiles` + `wallet_addresses`
2. **Query** → All holder views join with `social_profiles` via `wallet_addresses` to show twitter/discord/comment
3. **Search** → Backend filters profiles by address/twitter/discord/comment match, returns all wallets for matching profiles
4. **Delete** → DELETE `/api/social-profiles/:id` → cascades to wallet_addresses

### Search Flow (Current)
1. User types in SearchBar → local `inputValue` updates immediately
2. After 300ms debounce → URL `?search=` param updated via `setSearchParams()`
3. Each component reads `searchParams.get('search')` → triggers `useEffect`
4. `useEffect` creates `AbortController`, passes signal to API call
5. Previous request aborted if still in-flight
6. Backend filters server-side, returns results
7. Component updates its local data state
