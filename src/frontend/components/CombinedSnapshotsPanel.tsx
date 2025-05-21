import { useEffect, useRef, useState } from 'react';

import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { SelectButton } from 'primereact/selectbutton';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';

import { EventNFTSnapshot, EventTokenSnapshot } from '../../types/index.js';
// Import API functions but declare them as 'any' type to avoid TypeScript errors
// This is a workaround for TypeScript not recognizing the full function signatures
import * as api from '../services/api.js';
import { truncateAddress } from '../utils/addressUtils.js';
import { formatNumber, formatRelativeTime } from '../utils/formatting.js';
import SocialPillComment from './SocialPillComment.js';
import SocialPillDiscord from './SocialPillDiscord.js';
import SocialPillX from './SocialPillX.js';


// Creating strongly-typed wrappers for our API functions
const fetchTokenSnapshotsWithEvents = (limit: number, skip: number = 0): Promise<EventTokenSnapshot[]> => {
  // @ts-expect-error API type definitions have issues with the second parameter
  return api.fetchTokenSnapshotsWithEvents(limit, skip);
};

const fetchNFTSnapshotsWithEvents = (limit: number, skip: number = 0): Promise<EventNFTSnapshot[]> => {
  // @ts-expect-error API type definitions have issues with the second parameter
  return api.fetchNFTSnapshotsWithEvents(limit, skip);
};

// Wrapper for takeNftSnapshot
const takeNftSnapshot = async (): Promise<any> => {
  return api.takeNftSnapshot();
};

// Wrapper for takeTokenSnapshot
const takeTokenSnapshot = async (): Promise<any> => {
  return api.takeTokenSnapshot();
};

// Combined event type for unified display
interface CombinedEvent {
  id: number;
  event_timestamp: string;
  event_type: string;
  snapshot_timestamp: string;
  snapshot_id: number;
  source_address?: string;
  destination_address?: string;
  amount?: number;
  previous_balance?: number;
  new_balance?: number;
  nft_name?: string;
  nft_type?: string;
  mint?: string;
  twitter?: string;
  discord?: string;
  comment?: string;
  source_twitter?: string;
  source_discord?: string;
  source_comment?: string;
  dest_twitter?: string;
  dest_discord?: string;
  dest_comment?: string;
  type: 'token' | 'nft';
}

const CombinedSnapshotsPanel: React.FC = () => {
  const [tokenSnapshots, setTokenSnapshots] = useState<EventTokenSnapshot[]>([]);
  const [nftSnapshots, setNftSnapshots] = useState<EventNFTSnapshot[]>([]);
  const [allEvents, setAllEvents] = useState<CombinedEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<CombinedEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [tokenSnapshotLoading, setTokenSnapshotLoading] = useState<boolean>(false);
  const [nftSnapshotLoading, setNftSnapshotLoading] = useState<boolean>(false);
  
  // Initialize with 'all' instead of null as the default value
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  
  const [showBothTypes, setShowBothTypes] = useState(true);
  const [showTokenOnly, setShowTokenOnly] = useState(false);
  const [showNftOnly, setShowNftOnly] = useState(false);

  // Refs for loading state
  const loadingMoreRef = useRef<boolean>(false);
  const hasMoreRef = useRef<boolean>(true);
  const toastRef = useRef<Toast>(null);
  
  // This useEffect triggers the initial data fetch
  useEffect(() => {
    loadInitialSnapshots();
  }, []);
  
  // This useEffect combines all events whenever snapshots change or filters change
  useEffect(() => {
    console.log('Combining all events from snapshots with filters');
    combineAndFilterEvents();
  }, [tokenSnapshots, nftSnapshots, showBothTypes, showTokenOnly, showNftOnly, eventTypeFilter]);
  
  // This useEffect logs the filtered events whenever they change
  useEffect(() => {
    console.log('Filtered events updated, count:', filteredEvents.length);
  }, [filteredEvents]);

  // Combine all events from all snapshots and apply filters
  const combineAndFilterEvents = () => {
    console.log("Running combineAndFilterEvents");
    console.log("Filter states - Type:", showBothTypes ? "All" : showTokenOnly ? "Tokens" : "NFTs", 
                "EventType:", eventTypeFilter);
    
    let combinedEvents: CombinedEvent[] = [];
    
    // Process token events if they should be shown
    if (showBothTypes || showTokenOnly) {
      console.log("Processing token events from", tokenSnapshots.length, "snapshots");
      
      for (const snapshot of tokenSnapshots) {
        if (snapshot.events && snapshot.events.length > 0) {
          const snapshotEvents = snapshot.events.map(event => ({
            ...event,
            type: 'token' as const
          }));
          combinedEvents = combinedEvents.concat(snapshotEvents);
        }
      }
    }
    
    // Process NFT events if they should be shown
    if (showBothTypes || showNftOnly) {
      console.log("Processing NFT events from", nftSnapshots.length, "snapshots");
      
      for (const snapshot of nftSnapshots) {
        if (snapshot.events && snapshot.events.length > 0) {
          const snapshotEvents = snapshot.events.map(event => ({
            ...event,
            type: 'nft' as const
          }));
          combinedEvents = combinedEvents.concat(snapshotEvents);
        }
      }
    }
    
    // Sort all events by timestamp (newest first)
    combinedEvents.sort((a, b) => 
      new Date(b.event_timestamp).getTime() - new Date(a.event_timestamp).getTime()
    );
    
    console.log("Combined", combinedEvents.length, "total events");
    setAllEvents(combinedEvents);
    
    // Apply event type filter if selected
    if (eventTypeFilter && eventTypeFilter !== 'all') {
      const filtered = combinedEvents.filter(event => 
        event.event_type === eventTypeFilter
      );
      console.log("Filtered to", filtered.length, "events of type", eventTypeFilter);
      setFilteredEvents(filtered);
    } else {
      console.log("No event type filter applied");
      setFilteredEvents(combinedEvents);
    }
  };
  
  const loadInitialSnapshots = async () => {
    setLoading(true);
    try {
      // Load initial batch of token snapshots
      console.log("Fetching initial token snapshots...");
      let tokenSnapshotsData;
      try {
        tokenSnapshotsData = await fetchTokenSnapshotsWithEvents(5);
        console.log("Token snapshots raw response:", tokenSnapshotsData);
      } catch (err) {
        console.error("Error fetching token snapshots:", err);
        tokenSnapshotsData = [];
      }
      
      // Ensure we have an array, even if empty
      const tokenSnapshotsArray = Array.isArray(tokenSnapshotsData) ? tokenSnapshotsData : [];
      console.log("Token snapshots processed:", tokenSnapshotsArray);
      setTokenSnapshots(tokenSnapshotsArray);
      
      // Load initial batch of NFT snapshots
      console.log("Fetching initial NFT snapshots...");
      let nftSnapshotsData;
      try {
        nftSnapshotsData = await fetchNFTSnapshotsWithEvents(5);
        console.log("NFT snapshots raw response:", nftSnapshotsData);
      } catch (err) {
        console.error("Error fetching NFT snapshots:", err);
        nftSnapshotsData = [];
      }
      
      // Ensure we have an array, even if empty
      const nftSnapshotsArray = Array.isArray(nftSnapshotsData) ? nftSnapshotsData : [];
      console.log("NFT snapshots processed:", nftSnapshotsArray);
      setNftSnapshots(nftSnapshotsArray);
    } catch (error) {
      console.error('Error loading snapshots:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const loadMoreSnapshots = async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    
    loadingMoreRef.current = true;
    
    try {
      // Calculate how many more snapshots to load
      const loadedTokenCount = tokenSnapshots.length;
      const loadedNftCount = nftSnapshots.length;
      
      console.log(`Loading more snapshots. Current counts - Tokens: ${loadedTokenCount}, NFTs: ${loadedNftCount}`);
      
      // Get more token snapshots if needed
      const newTokenSnapshots = await fetchTokenSnapshotsWithEvents(5, loadedTokenCount);
      console.log("Additional token snapshots:", newTokenSnapshots);
      
      // Get more NFT snapshots if needed
      const newNftSnapshots = await fetchNFTSnapshotsWithEvents(5, loadedNftCount);
      console.log("Additional NFT snapshots:", newNftSnapshots);
      
      // Check if we have more data to load
      hasMoreRef.current = 
        (newTokenSnapshots && newTokenSnapshots.length > 0) || 
        (newNftSnapshots && newNftSnapshots.length > 0);
      
      // Update the state with new snapshots
      if (newTokenSnapshots && newTokenSnapshots.length > 0) {
        setTokenSnapshots(prev => [...prev, ...newTokenSnapshots]);
      }
      
      if (newNftSnapshots && newNftSnapshots.length > 0) {
        setNftSnapshots(prev => [...prev, ...newNftSnapshots]);
      }
    } catch (error) {
      console.error('Error loading more snapshots:', error);
    } finally {
      loadingMoreRef.current = false;
    }
  };

  // Take token snapshot handler
  const handleTakeTokenSnapshot = async () => {
    setTokenSnapshotLoading(true);
    try {
      const result = await takeTokenSnapshot();
      console.log('Token snapshot taken:', result);
      toastRef.current?.show({ 
        severity: 'success', 
        summary: 'Token Snapshot Taken', 
        detail: 'New token snapshot captured successfully',
        life: 3000
      });
      // Reload data after taking snapshot
      loadInitialSnapshots();
    } catch (error) {
      console.error('Error taking token snapshot:', error);
      toastRef.current?.show({ 
        severity: 'error', 
        summary: 'Error', 
        detail: 'Failed to take token snapshot',
        life: 3000
      });
    } finally {
      setTokenSnapshotLoading(false);
    }
  };

  // Take NFT snapshot handler
  const handleTakeNftSnapshot = async () => {
    setNftSnapshotLoading(true);
    try {
      const result = await takeNftSnapshot();
      console.log('NFT snapshot taken:', result);
      toastRef.current?.show({ 
        severity: 'success', 
        summary: 'NFT Snapshot Taken', 
        detail: 'New NFT snapshot captured successfully',
        life: 3000
      });
      // Reload data after taking snapshot
      loadInitialSnapshots();
    } catch (error) {
      console.error('Error taking NFT snapshot:', error);
      toastRef.current?.show({ 
        severity: 'error', 
        summary: 'Error', 
        detail: 'Failed to take NFT snapshot',
        life: 3000
      });
    } finally {
      setNftSnapshotLoading(false);
    }
  };
  
  // Render event type badge
  const eventTypeBadge = (event: CombinedEvent) => {
    let severity: 'success' | 'info' | 'warning' | 'danger' | 'secondary' = 'info';
    let text = '';
    let icon = '';

    switch (event.event_type) {
      case 'new_holder':
        severity = 'success';
        text = 'New';
        icon = 'pi pi-plus-circle';
        break;
      case 'transfer_in':
        severity = 'success';
        text = 'In';
        icon = 'pi pi-arrow-right';
        break;
      case 'transfer_out':
        severity = 'warning';
        text = 'Out';
        icon = 'pi pi-arrow-left';
        break;
      case 'transfer_between':
        severity = 'info';
        text = 'Transfer';
        icon = 'pi pi-arrows-h';
        break;
      case 'wallet_empty':
        severity = 'danger';
        text = 'Empty';
        icon = 'pi pi-minus-circle';
        break;
      default:
        text = event.event_type;
        icon = 'pi pi-info-circle';
    }

    return (
      <div className="flex align-items-center">
        <i className={`${icon} mr-2`} />
        <Tag severity={severity} value={text} />
      </div>
    );
  };

  // Asset type badge (token/nft)
  const assetTypeBadge = (event: CombinedEvent) => {
    if (event.type === 'token') {
      return <Tag severity="success" value="Token" />;
    } else {
      return <Tag severity="info" value="NFT" />;
    }
  };
  
  // Format timestamp
  const timestampTemplate = (event: CombinedEvent) => {
    const date = new Date(event.event_timestamp);
    return (
      <div className="flex flex-column">
        <span className="font-semibold">{formatRelativeTime(date)}</span>
        <span className="text-sm text-color-secondary">
          {date.toLocaleString()}
        </span>
      </div>
    );
  };
  
  // Snapshot timestamp template
  const snapshotTimestampTemplate = (event: CombinedEvent) => {
    const date = new Date(event.snapshot_timestamp);
    return (
      <div className="flex flex-column">
        <span className="font-medium">{date.toLocaleDateString()}</span>
        <span className="text-sm text-color-secondary">
          {formatRelativeTime(date)}
        </span>
      </div>
    );
  };

  // Format wallet address with X/Discord if available
  const addressTemplate = (address?: string, twitter?: string, discord?: string, comment?: string) => {
    if (!address) return null;
    const solscanUrl = `https://solscan.io/account/${address}`;
    return (
      <div className="flex flex-column">
        <div className="flex align-items-center">
          <a href={solscanUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex align-items-center">
            {truncateAddress(address)}
            <img src="/solscan_logo.png" alt="Solscan" width="14" height="14" className="ml-1" style={{ opacity: 0.7, verticalAlign: 'middle' }} />
          </a>
        </div>
        {comment ? (
          <SocialPillComment text={comment} className="mt-1" style={{ fontWeight: 500 }} />
        ) : (twitter || discord) && (
          <div className="flex mt-1 gap-2">
            {twitter && <SocialPillX handle={twitter} />}
            {discord && <SocialPillDiscord handle={discord} />}
          </div>
        )}
      </div>
    );
  };
  
  // Source address template
  const sourceAddressTemplate = (event: CombinedEvent) => {
    return addressTemplate(event.source_address, event.source_twitter, event.source_discord, event.source_comment);
  };

  // Destination address template
  const destinationAddressTemplate = (event: CombinedEvent) => {
    return addressTemplate(event.destination_address, event.dest_twitter, event.dest_discord, event.dest_comment);
  };
  
  // Amount/NFT details template
  const assetDetailsTemplate = (event: CombinedEvent) => {
    if (event.type === 'token' && event.amount !== undefined) {
      return <span className="text-lg">{formatNumber(event.amount)}</span>;
    } else if (event.type === 'nft' && event.nft_name) {
      return (
        <div className="flex flex-column">
          <span className="font-medium">{event.nft_name}</span>
          {event.nft_type && (
            <Tag severity={event.nft_type === 'Gen1' ? 'success' : 'info'} className="mt-1">
              {event.nft_type}
            </Tag>
          )}
        </div>
      );
    }
    return <span>-</span>;
  };
  
  // Social profile template
  const socialProfileTemplate = (event: CombinedEvent) => {
    // Determine if it's a self-transfer within the same profile
    const isSelfTransfer = 
      event.event_type === 'transfer_between' && 
      event.twitter && event.source_twitter && event.dest_twitter &&
      event.twitter === event.source_twitter && event.twitter === event.dest_twitter;

    // If no profiles found
    if (!event.twitter && !event.discord && !event.comment && 
        !event.source_twitter && !event.source_discord && !event.source_comment &&
        !event.dest_twitter && !event.dest_discord && !event.dest_comment) {
      return <span>-</span>;
    }
    
    if (isSelfTransfer) {
      // For self transfers, show just the profile with a self-transfer tag
      return (
        <div className="flex flex-column">
          {event.comment ? (
            <SocialPillComment text={event.comment} className="mb-1" style={{ fontWeight: 500 }} />
          ) : (
            <div className="flex gap-2 align-items-center mb-1">
              {event.twitter && <SocialPillX handle={event.twitter} />}
              {event.discord && <SocialPillDiscord handle={event.discord} />}
            </div>
          )}
          <Tag severity="info" icon="pi pi-arrows-h">Self Transfer</Tag>
        </div>
      );
    } else if (event.event_type === 'transfer_between' || 
               event.event_type === 'transfer_in' || 
               event.event_type === 'transfer_out') {
      // For transfers between different profiles or unknown profiles
      const hasSource = event.source_twitter || event.source_discord || event.source_comment;
      const hasDest = event.dest_twitter || event.dest_discord || event.dest_comment;
      
      if (hasSource && hasDest) {
        // Both source and destination have profiles
        return (
          <div className="flex flex-column gap-2">
            <div className="flex flex-column">
              <span className="text-sm text-color-secondary">From:</span>
              <div className="flex gap-1">
                {event.source_comment ? (
                  <SocialPillComment text={event.source_comment} style={{ fontWeight: 500 }} />
                ) : (
                  <>
                    {event.source_twitter && <SocialPillX handle={event.source_twitter} />}
                    {event.source_discord && <SocialPillDiscord handle={event.source_discord} />}
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-column">
              <span className="text-sm text-color-secondary">To:</span>
              <div className="flex gap-1">
                {event.dest_comment ? (
                  <SocialPillComment text={event.dest_comment} style={{ fontWeight: 500 }} />
                ) : (
                  <>
                    {event.dest_twitter && <SocialPillX handle={event.dest_twitter} />}
                    {event.dest_discord && <SocialPillDiscord handle={event.dest_discord} />}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      } else if (hasSource) {
        // Only source has a profile
        return (
          <div className="flex flex-column">
            <span className="text-sm text-color-secondary">From:</span>
            <div className="flex gap-1">
              {event.source_comment ? (
                <SocialPillComment text={event.source_comment} style={{ fontWeight: 500 }} />
              ) : (
                <>
                  {event.source_twitter && <SocialPillX handle={event.source_twitter} />}
                  {event.source_discord && <SocialPillDiscord handle={event.source_discord} />}
                </>
              )}
            </div>
          </div>
        );
      } else if (hasDest) {
        // Only destination has a profile
        return (
          <div className="flex flex-column">
            <span className="text-sm text-color-secondary">To:</span>
            <div className="flex gap-1">
              {event.dest_comment ? (
                <SocialPillComment text={event.dest_comment} style={{ fontWeight: 500 }} />
              ) : (
                <>
                  {event.dest_twitter && <SocialPillX handle={event.dest_twitter} />}
                  {event.dest_discord && <SocialPillDiscord handle={event.dest_discord} />}
                </>
              )}
            </div>
          </div>
        );
      }
    }
    
    // For non-transfer events or fallback
    return (
      <div className="flex flex-column">
        <div className="flex gap-2 flex-wrap">
          {event.comment ? (
            <SocialPillComment text={event.comment} style={{ fontWeight: 500 }} />
          ) : (
            <>
              {event.twitter && <SocialPillX handle={event.twitter} />}
              {event.discord && <SocialPillDiscord handle={event.discord} />}
            </>
          )}
        </div>
      </div>
    );
  };

  // Filter controls
  const filterControls = () => {
    const typeOptions = [
      { label: 'All Types', value: 'all' },
      { label: 'Tokens Only', value: 'tokens' },
      { label: 'NFTs Only', value: 'nfts' }
    ];
    
    const selectedTypeValue = showBothTypes 
      ? 'all' 
      : showTokenOnly 
        ? 'tokens' 
        : 'nfts';
    
    const onTypeChange = (e: { value: string }) => {
      const value = e.value;
      if (value === 'all') {
        setShowBothTypes(true);
        setShowTokenOnly(false);
        setShowNftOnly(false);
      } else if (value === 'tokens') {
        setShowBothTypes(false);
        setShowTokenOnly(true);
        setShowNftOnly(false);
      } else if (value === 'nfts') {
        setShowBothTypes(false);
        setShowTokenOnly(false);
        setShowNftOnly(true);
      }
    };
    
    return (
      <div className="flex flex-column gap-3 mb-3">
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button 
              label="Take Token Snapshot" 
              icon="pi pi-camera"
              onClick={handleTakeTokenSnapshot}
              loading={tokenSnapshotLoading}
              className="p-button-success p-button-sm"
            />
            <Button 
              label="Take NFT Snapshot" 
              icon="pi pi-camera"
              onClick={handleTakeNftSnapshot}
              loading={nftSnapshotLoading}
              className="p-button-info p-button-sm"
            />
          </div>
          <Button 
            icon="pi pi-refresh" 
            onClick={loadInitialSnapshots}
            loading={loading}
            className="p-button-outlined p-button-sm"
            tooltip="Refresh Data"
          />
        </div>
        
        <div className="flex justify-between items-center">
          <div>
            <style>
              {`
                .separated-button .p-button {
                  margin-right: 0.5rem;
                  border-radius: 6px !important;
                }
                .separated-button .p-button:last-child {
                  margin-right: 0;
                }
                .separated-button .p-selectbutton {
                  display: flex;
                  flex-wrap: nowrap;
                }
              `}
            </style>
            <SelectButton 
              value={selectedTypeValue} 
              options={typeOptions} 
              onChange={onTypeChange}
              className="p-buttonset-sm separated-button"
            />
          </div>
          
          <Dropdown
            value={eventTypeFilter}
            options={[
              { label: 'All Events', value: 'all' },
              { label: 'New Holders', value: 'new_holder' },
              { label: 'Transfers In', value: 'transfer_in' },
              { label: 'Transfers Out', value: 'transfer_out' },
              { label: 'Transfers Between', value: 'transfer_between' },
              { label: 'Empty Wallets', value: 'wallet_empty' }
            ]}
            onChange={(e) => {
              const newValue = e.value;
              console.log('Setting event type filter to:', newValue);
              setEventTypeFilter(newValue);
            }}
            placeholder="Filter by event type"
            className="w-12rem"
          />
        </div>
      </div>
    );
  };
  
  // Load more button
  const loadMoreButton = () => {
    return (
      <div className="flex justify-center mt-3">
        <Button 
          label="Load More"
          icon="pi pi-plus"
          onClick={loadMoreSnapshots}
          disabled={loadingMoreRef.current || !hasMoreRef.current}
          loading={loadingMoreRef.current}
          className="p-button-outlined"
        />
      </div>
    );
  };
  
  return (
    <div className="combined-snapshots-panel">
      <Toast ref={toastRef} />
      <h2>Snapshots Timeline</h2>
      {filterControls()}
      
      <DataTable
        value={filteredEvents}
        scrollable
        scrollHeight="550px"
        loading={loading}
        emptyMessage="No events found"
        sortField="event_timestamp"
        sortOrder={-1}
        className="p-datatable-sm"
      >
        <Column field="event_type" header="Type" body={eventTypeBadge} style={{ width: '100px' }} />
        <Column field="type" header="Asset" body={assetTypeBadge} style={{ width: '80px' }} />
        <Column field="event_timestamp" header="When" body={timestampTemplate} style={{ width: '180px' }} sortable />
        <Column field="snapshot_timestamp" header="Snapshot" body={snapshotTimestampTemplate} style={{ width: '120px' }} />
        <Column field="source_address" header="From" body={sourceAddressTemplate} />
        <Column field="destination_address" header="To" body={destinationAddressTemplate} />
        <Column field="asset_details" header="Details" body={assetDetailsTemplate} style={{ width: '150px' }} />
        <Column field="social_profile" header="Social Profile" body={socialProfileTemplate} style={{ width: '180px' }} />
      </DataTable>
      
      {loadMoreButton()}
      
      {/* Debug info */}
      {filteredEvents.length === 0 && !loading && (
        <div className="mt-4 p-3 surface-100 border-round">
          <h3>Debug Information</h3>
          <p>Token Snapshots: {tokenSnapshots.length}</p>
          <p>NFT Snapshots: {nftSnapshots.length}</p>
          <p>Total Combined Events: {allEvents.length}</p>
          <p>Filtered Events: {filteredEvents.length}</p>
          <p>Show Both Types: {showBothTypes.toString()}</p>
          <p>Show Token Only: {showTokenOnly.toString()}</p>
          <p>Show NFT Only: {showNftOnly.toString()}</p>
          <p>Event Type Filter: {eventTypeFilter}</p>
          <button 
            className="p-button p-button-sm p-button-outlined mt-2"
            onClick={() => {
              // Force a combine and re-render
              combineAndFilterEvents();
            }}
          >
            Force refresh
          </button>
        </div>
      )}
    </div>
  );
};

export default CombinedSnapshotsPanel; 