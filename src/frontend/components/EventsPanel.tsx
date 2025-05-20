import React, { useEffect, useState } from 'react';

import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { TabPanel, TabView } from 'primereact/tabview';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';

import { EventNFTSnapshot, EventTokenSnapshot, NFTEvent, TokenEvent } from '../../types/index.js';
import {
  fetchNFTSnapshotsWithEvents,
  fetchTokenSnapshotsWithEvents,
  takeNftSnapshot,
  takeTokenSnapshot
} from '../services/api.js';
import { truncateAddress } from '../utils/addressUtils.js';
import { formatDate, formatNumber, formatRelativeTime } from '../utils/formatting.js';

const EventsPanel: React.FC = () => {
  const [tokenSnapshots, setTokenSnapshots] = useState<EventTokenSnapshot[]>([]);
  const [nftSnapshots, setNftSnapshots] = useState<EventNFTSnapshot[]>([]);
  const [selectedTokenSnapshot, setSelectedTokenSnapshot] = useState<EventTokenSnapshot | null>(null);
  const [selectedNftSnapshot, setSelectedNftSnapshot] = useState<EventNFTSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [tokenSnapshotLoading, setTokenSnapshotLoading] = useState<boolean>(false);
  const [nftSnapshotLoading, setNftSnapshotLoading] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const toastRef = React.useRef<Toast>(null);

  useEffect(() => {
    loadSnapshots();
  }, []);

  const loadSnapshots = async () => {
    setLoading(true);
    try {
      // Load token snapshots with events
      const tokenSnapshotsData = await fetchTokenSnapshotsWithEvents();
      setTokenSnapshots(tokenSnapshotsData);
      if (tokenSnapshotsData && tokenSnapshotsData.length > 0) {
        const firstSnapshot = tokenSnapshotsData[0];
        if (firstSnapshot) {
          setSelectedTokenSnapshot(firstSnapshot);
        }
      }

      // Load NFT snapshots with events
      const nftSnapshotsData = await fetchNFTSnapshotsWithEvents();
      setNftSnapshots(nftSnapshotsData);
      if (nftSnapshotsData && nftSnapshotsData.length > 0) {
        const firstSnapshot = nftSnapshotsData[0];
        if (firstSnapshot) {
          setSelectedNftSnapshot(firstSnapshot);
        }
      }
    } catch (error) {
      console.error('Error loading snapshots with events:', error);
    } finally {
      setLoading(false);
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
      loadSnapshots();
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
      loadSnapshots();
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
  const eventTypeBadge = (event: TokenEvent | NFTEvent) => {
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

  // Format timestamp
  const timestampTemplate = (rowData: TokenEvent | NFTEvent) => {
    const date = new Date(rowData.event_timestamp);
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
  const snapshotTimestampTemplate = (rowData: TokenEvent | NFTEvent) => {
    const date = new Date(rowData.snapshot_timestamp);
    return (
      <div className="flex flex-column">
        <span className="font-medium">{formatDate(date, 'short')}</span>
        <span className="text-sm text-color-secondary">
          {formatRelativeTime(date)}
        </span>
      </div>
    );
  };

  // Format wallet address with Twitter/Discord if available
  const addressTemplate = (address?: string, twitter?: string, discord?: string) => {
    if (!address) return null;
    
    const solscanUrl = `https://solscan.io/account/${address}`;
    
    return (
      <div className="flex flex-column">
        <div className="flex align-items-center">
          <a href={solscanUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {truncateAddress(address)}
          </a>
          <i className="pi pi-external-link ml-1 text-xs text-color-secondary"></i>
        </div>
        {(twitter || discord) && (
          <div className="flex mt-1 gap-2">
            {twitter && (
              <Tag severity="info" icon="pi pi-twitter">
                {twitter}
              </Tag>
            )}
            {discord && (
              <Tag severity="secondary" icon="pi pi-discord">
                {discord}
              </Tag>
            )}
          </div>
        )}
      </div>
    );
  };

  // Social profile template
  const socialProfileTemplate = (rowData: TokenEvent | NFTEvent) => {
    // Determine if it's a self-transfer within the same profile
    const isSelfTransfer = 
      rowData.event_type === 'transfer_between' && 
      rowData.twitter && rowData.source_twitter && rowData.dest_twitter &&
      rowData.twitter === rowData.source_twitter && rowData.twitter === rowData.dest_twitter;

    // If no profiles found
    if (!rowData.twitter && !rowData.discord && !rowData.comment && 
        !rowData.source_twitter && !rowData.source_discord && 
        !rowData.dest_twitter && !rowData.dest_discord) {
      return <span>-</span>;
    }
    
    if (isSelfTransfer) {
      // For self transfers, show just the profile with a self-transfer tag
      return (
        <div className="flex flex-column">
          {rowData.comment && <span className="font-medium mb-1">{rowData.comment}</span>}
          <div className="flex gap-2 align-items-center">
            {rowData.twitter && (
              <Tag severity="info" icon="pi pi-twitter">
                {rowData.twitter}
              </Tag>
            )}
            {rowData.discord && (
              <Tag severity="secondary" icon="pi pi-discord">
                {rowData.discord}
              </Tag>
            )}
            <Tag severity="info" icon="pi pi-arrows-h">Self Transfer</Tag>
          </div>
        </div>
      );
    } else if (rowData.event_type === 'transfer_between' || 
               rowData.event_type === 'transfer_in' || 
               rowData.event_type === 'transfer_out') {
      // For transfers between different profiles or unknown profiles
      const hasSource = rowData.source_twitter || rowData.source_discord;
      const hasDest = rowData.dest_twitter || rowData.dest_discord;
      
      if (hasSource && hasDest) {
        // Both source and destination have profiles
        return (
          <div className="flex flex-column gap-2">
            <div className="flex flex-column">
              <span className="text-sm text-color-secondary">From:</span>
              <div className="flex gap-1">
                {rowData.source_twitter && (
                  <Tag severity="info" icon="pi pi-twitter">{rowData.source_twitter}</Tag>
                )}
                {rowData.source_discord && (
                  <Tag severity="secondary" icon="pi pi-discord">{rowData.source_discord}</Tag>
                )}
              </div>
            </div>
            <div className="flex flex-column">
              <span className="text-sm text-color-secondary">To:</span>
              <div className="flex gap-1">
                {rowData.dest_twitter && (
                  <Tag severity="info" icon="pi pi-twitter">{rowData.dest_twitter}</Tag>
                )}
                {rowData.dest_discord && (
                  <Tag severity="secondary" icon="pi pi-discord">{rowData.dest_discord}</Tag>
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
              {rowData.source_twitter && (
                <Tag severity="info" icon="pi pi-twitter">{rowData.source_twitter}</Tag>
              )}
              {rowData.source_discord && (
                <Tag severity="secondary" icon="pi pi-discord">{rowData.source_discord}</Tag>
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
              {rowData.dest_twitter && (
                <Tag severity="info" icon="pi pi-twitter">{rowData.dest_twitter}</Tag>
              )}
              {rowData.dest_discord && (
                <Tag severity="secondary" icon="pi pi-discord">{rowData.dest_discord}</Tag>
              )}
            </div>
          </div>
        );
      }
    }
    
    // For non-transfer events or fallback
    return (
      <div className="flex flex-column">
        {rowData.comment && <span className="font-medium mb-1">{rowData.comment}</span>}
        <div className="flex gap-2">
          {rowData.twitter && (
            <Tag severity="info" icon="pi pi-twitter">
              {rowData.twitter}
            </Tag>
          )}
          {rowData.discord && (
            <Tag severity="secondary" icon="pi pi-discord">
              {rowData.discord}
            </Tag>
          )}
        </div>
      </div>
    );
  };

  // Token amount template
  const amountTemplate = (rowData: TokenEvent) => {
    return (
      <span className="text-lg">
        {formatNumber(rowData.amount)}
      </span>
    );
  };

  // Token source address template
  const sourceAddressTemplate = (rowData: TokenEvent) => {
    return addressTemplate(rowData.source_address, rowData.source_twitter, rowData.source_discord);
  };

  // Token destination address template
  const destinationAddressTemplate = (rowData: TokenEvent) => {
    return addressTemplate(rowData.destination_address, rowData.dest_twitter, rowData.dest_discord);
  };

  // NFT address templates
  const nftSourceTemplate = (rowData: NFTEvent) => {
    return addressTemplate(rowData.source_address);
  };

  const nftDestinationTemplate = (rowData: NFTEvent) => {
    return addressTemplate(rowData.destination_address);
  };

  // NFT details template
  const nftDetailsTemplate = (rowData: NFTEvent) => {
    return (
      <div className="flex flex-column">
        <span className="font-medium">{rowData.nft_name}</span>
        <Tag severity={rowData.nft_type === 'Gen1' ? 'success' : 'info'} className="mt-1">
          {rowData.nft_type}
        </Tag>
      </div>
    );
  };

  // Balance change template
  const balanceChangeTemplate = (rowData: TokenEvent) => {
    if (rowData.previous_balance === undefined || rowData.new_balance === undefined) {
      return null;
    }

    const change = rowData.new_balance - rowData.previous_balance;
    const percentChange = 
      rowData.previous_balance !== 0 
        ? ((change / rowData.previous_balance) * 100).toFixed(2) 
        : '∞';
    
    const isPositive = change > 0;
    
    return (
      <div className="flex flex-column">
        <span className={isPositive ? 'text-green-500' : 'text-red-500'}>
          {isPositive ? '+' : ''}{formatNumber(change)} ({isPositive ? '+' : ''}{percentChange}%)
        </span>
        <span className="text-sm text-color-secondary">
          {formatNumber(rowData.previous_balance)} → {formatNumber(rowData.new_balance)}
        </span>
      </div>
    );
  };

  // Snapshot selector for token events
  const tokenSnapshotSelector = () => {
    if (tokenSnapshots.length === 0) return null;

    const options = tokenSnapshots.map(snapshot => ({
      label: `${formatDate(snapshot.timestamp, 'medium')} (${snapshot.events.length} events)`,
      value: snapshot.id
    }));

    return (
      <div className="flex justify-between align-items-center mb-3">
        <div className="flex align-items-center">
          <span className="font-medium mr-2">Snapshot:</span>
          <Dropdown
            value={selectedTokenSnapshot?.id}
            options={options}
            onChange={(e) => {
              if (e.value) {
                const selected = tokenSnapshots.find(s => s.id === e.value);
                if (selected) {
                  setSelectedTokenSnapshot(selected);
                }
              }
            }}
            placeholder="Select a snapshot"
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            label="Take Token Snapshot"
            icon="pi pi-camera"
            onClick={handleTakeTokenSnapshot}
            loading={tokenSnapshotLoading}
            className="p-button-success p-button-sm"
          />
          <Button
            icon="pi pi-refresh"
            onClick={loadSnapshots}
            tooltip="Refresh Data"
            className="p-button-outlined p-button-sm"
          />
        </div>
      </div>
    );
  };

  // Snapshot selector for NFT events
  const nftSnapshotSelector = () => {
    if (nftSnapshots.length === 0) return null;

    const options = nftSnapshots.map(snapshot => ({
      label: `${formatDate(snapshot.timestamp, 'medium')} (${snapshot.events.length} events)`,
      value: snapshot.id
    }));

    return (
      <div className="flex justify-between align-items-center mb-3">
        <div className="flex align-items-center">
          <span className="font-medium mr-2">Snapshot:</span>
          <Dropdown
            value={selectedNftSnapshot?.id}
            options={options}
            onChange={(e) => {
              if (e.value) {
                const selected = nftSnapshots.find(s => s.id === e.value);
                if (selected) {
                  setSelectedNftSnapshot(selected);
                }
              }
            }}
            placeholder="Select a snapshot"
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            label="Take NFT Snapshot"
            icon="pi pi-camera"
            onClick={handleTakeNftSnapshot}
            loading={nftSnapshotLoading}
            className="p-button-info p-button-sm"
          />
          <Button
            icon="pi pi-refresh"
            onClick={loadSnapshots}
            tooltip="Refresh Data"
            className="p-button-outlined p-button-sm"
          />
        </div>
      </div>
    );
  };

  // Get events from selected token snapshot
  const selectedTokenEvents = selectedTokenSnapshot?.events || [];
  
  // Get events from selected NFT snapshot
  const selectedNftEvents = selectedNftSnapshot?.events || [];

  return (
    <Card className="mb-5" title="Activity by Snapshot" subTitle="View changes between snapshots">
      <Toast ref={toastRef} />
      <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
        <TabPanel header="Token Events" leftIcon="pi pi-dollar mr-2">
          {tokenSnapshotSelector()}
          <DataTable 
            value={selectedTokenEvents} 
            loading={loading}
            paginator 
            rows={10}
            rowsPerPageOptions={[10, 25, 50]} 
            emptyMessage="No token events found"
            sortField="event_timestamp"
            sortOrder={-1}
            className="p-datatable-sm"
          >
            <Column field="event_type" header="Type" body={eventTypeBadge} style={{ width: '120px' }} />
            <Column field="event_timestamp" header="When" body={timestampTemplate} sortable style={{ width: '150px' }} />
            <Column field="snapshot_timestamp" header="Snapshot" body={snapshotTimestampTemplate} style={{ width: '120px' }} />
            <Column field="source_address" header="From" body={sourceAddressTemplate} />
            <Column field="destination_address" header="To" body={destinationAddressTemplate} />
            <Column field="amount" header="Amount" body={amountTemplate} sortable style={{ width: '120px' }} />
            <Column field="balance_change" header="Balance Change" body={balanceChangeTemplate} style={{ width: '180px' }} />
            <Column field="social" header="Social Profile" body={socialProfileTemplate} style={{ width: '180px' }} />
          </DataTable>
        </TabPanel>
        
        <TabPanel header="NFT Events" leftIcon="pi pi-image mr-2">
          {nftSnapshotSelector()}
          <DataTable 
            value={selectedNftEvents} 
            loading={loading}
            paginator 
            rows={10}
            rowsPerPageOptions={[10, 25, 50]} 
            emptyMessage="No NFT events found"
            sortField="event_timestamp"
            sortOrder={-1}
            className="p-datatable-sm"
          >
            <Column field="event_type" header="Type" body={eventTypeBadge} style={{ width: '120px' }} />
            <Column field="event_timestamp" header="When" body={timestampTemplate} sortable style={{ width: '150px' }} />
            <Column field="snapshot_timestamp" header="Snapshot" body={snapshotTimestampTemplate} style={{ width: '120px' }} />
            <Column field="nft_details" header="NFT" body={nftDetailsTemplate} style={{ width: '200px' }} />
            <Column field="source_address" header="From" body={nftSourceTemplate} />
            <Column field="destination_address" header="To" body={nftDestinationTemplate} />
            <Column field="social" header="Social Profile" body={socialProfileTemplate} style={{ width: '180px' }} />
          </DataTable>
        </TabPanel>
      </TabView>
    </Card>
  );
};

export default EventsPanel; 