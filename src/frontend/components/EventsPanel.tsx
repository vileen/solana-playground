import React, { useEffect, useState } from 'react';

import { Card } from 'primereact/card';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { TabPanel, TabView } from 'primereact/tabview';
import { Tag } from 'primereact/tag';

import { EventNFTSnapshot, EventTokenSnapshot, NFTEvent, TokenEvent } from '../../types/index.js';
import {
  fetchNFTSnapshotsWithEvents,
  fetchTokenSnapshotsWithEvents
} from '../services/api.js';
import { truncateAddress } from '../utils/addressUtils.js';
import { formatDate, formatNumber, formatRelativeTime } from '../utils/formatting.js';

const EventsPanel: React.FC = () => {
  const [tokenSnapshots, setTokenSnapshots] = useState<EventTokenSnapshot[]>([]);
  const [nftSnapshots, setNftSnapshots] = useState<EventNFTSnapshot[]>([]);
  const [selectedTokenSnapshot, setSelectedTokenSnapshot] = useState<EventTokenSnapshot | null>(null);
  const [selectedNftSnapshot, setSelectedNftSnapshot] = useState<EventNFTSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeIndex, setActiveIndex] = useState(0);

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
    
    return (
      <div className="flex flex-column">
        <span className="font-medium">{truncateAddress(address)}</span>
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
      <div className="flex align-items-center mb-3">
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
      <div className="flex align-items-center mb-3">
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
    );
  };

  // Get events from selected token snapshot
  const selectedTokenEvents = selectedTokenSnapshot?.events || [];
  
  // Get events from selected NFT snapshot
  const selectedNftEvents = selectedNftSnapshot?.events || [];

  return (
    <Card className="mb-5" title="Activity by Snapshot" subTitle="View changes between snapshots">
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
          </DataTable>
        </TabPanel>
      </TabView>
    </Card>
  );
};

export default EventsPanel; 