import React from 'react';

import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { Tag } from 'primereact/tag';

import { NFTEvent, TokenEvent } from '../../types/index.js';
import { truncateAddress } from '../utils/addressUtils.js';
import { formatDate, formatNumber, formatRelativeTime } from '../utils/formatting.js';

interface SnapshotEventsDialogProps {
  visible: boolean;
  onHide: () => void;
  events: (TokenEvent | NFTEvent)[];
  snapshotType: 'token' | 'nft';
  snapshotTimestamp: string;
  eventTypeFilter?: string;
}

const SnapshotEventsDialog: React.FC<SnapshotEventsDialogProps> = ({
  visible,
  onHide,
  events,
  snapshotType,
  snapshotTimestamp,
  eventTypeFilter
}) => {
  
  // Filter events by type if filter is provided
  const filteredEvents = eventTypeFilter 
    ? events.filter(event => event.event_type === eventTypeFilter)
    : events;
  
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

  // Address template
  const addressTemplate = (address?: string) => {
    if (!address) return <span>-</span>;
    
    return (
      <div className="flex flex-column">
        <span className="font-medium">{truncateAddress(address)}</span>
        <Button
          icon="pi pi-copy"
          className="p-button-text p-button-sm"
          onClick={() => navigator.clipboard.writeText(address)}
          tooltip="Copy address"
        />
      </div>
    );
  };

  // Token amount template
  const amountTemplate = (rowData: any) => {
    if ('amount' in rowData) {
      return <span>{formatNumber(rowData.amount)}</span>;
    }
    return null;
  };

  // NFT details template
  const nftDetailsTemplate = (rowData: any) => {
    if ('mint' in rowData && 'nft_name' in rowData) {
      return (
        <div className="flex flex-column">
          <span className="font-medium">{rowData.nft_name}</span>
          <span className="text-sm text-color-secondary">{truncateAddress(rowData.mint)}</span>
        </div>
      );
    }
    return null;
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

  // Dialog header
  const dialogHeader = () => {
    const snapshotDate = new Date(snapshotTimestamp);
    const formattedDate = formatDate(snapshotDate, 'full');
    
    return (
      <div className="flex flex-column">
        <h2 className="m-0">
          {snapshotType === 'token' ? 'Token' : 'NFT'} Events{eventTypeFilter ? ` (${eventTypeFilter})` : ''}
        </h2>
        <p className="mt-1 mb-0">Snapshot from {formattedDate}</p>
      </div>
    );
  };

  return (
    <Dialog
      header={dialogHeader}
      visible={visible}
      onHide={onHide}
      style={{ width: '90vw' }}
      maximizable
      modal
      blockScroll
    >
      <DataTable 
        value={filteredEvents}
        paginator
        rows={10}
        rowsPerPageOptions={[10, 25, 50, 100]}
        emptyMessage="No events found"
        sortField="event_timestamp"
        sortOrder={-1}
        className="p-datatable-sm"
        resizableColumns
        columnResizeMode="fit"
      >
        <Column field="event_type" header="Type" body={eventTypeBadge} style={{ width: '120px' }} />
        <Column field="event_timestamp" header="When" body={timestampTemplate} sortable style={{ width: '180px' }} />
        
        {snapshotType === 'token' ? (
          <>
            <Column field="source_address" header="From" body={(rowData) => addressTemplate(rowData.source_address)} />
            <Column field="destination_address" header="To" body={(rowData) => addressTemplate(rowData.destination_address)} />
            <Column field="amount" header="Amount" body={amountTemplate} sortable style={{ width: '120px' }} />
          </>
        ) : (
          <>
            <Column field="nft_details" header="NFT" body={nftDetailsTemplate} style={{ width: '200px' }} />
            <Column field="source_address" header="From" body={(rowData) => addressTemplate(rowData.source_address)} />
            <Column field="destination_address" header="To" body={(rowData) => addressTemplate(rowData.destination_address)} />
          </>
        )}
        
        <Column field="social" header="Social Profile" body={socialProfileTemplate} style={{ width: '200px' }} />
      </DataTable>
    </Dialog>
  );
};

export default SnapshotEventsDialog; 