import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';

import { NFTHolder } from '../../types/index.js';
import * as API from '../services/api.js';

import SearchBar from './SearchBar.js';
import WalletAddress from './WalletAddress.js';
import XIcon from './XIcon.js';

interface NftHoldersProps {
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  onShowSocialDialog: (holder: NFTHolder) => void;
}

// Use forwardRef to expose methods to parent component
const NftHolders = forwardRef<{ fetchHolders: () => Promise<void> }, NftHoldersProps>(
  ({ onError, onSuccess, onShowSocialDialog }, ref) => {
    const [searchParams] = useSearchParams();
    const searchTerm = searchParams.get('search') || '';

    const [holders, setHolders] = useState<NFTHolder[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedRows, setExpandedRows] = useState<any>(null);
    const [sortField, setSortField] = useState('nftCount');
    const [sortOrder, setSortOrder] = useState<1 | -1>(-1);
    const [snapshots, setSnapshots] = useState<any[]>([]);
    const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      fetchHolders: () => fetchHolders(searchTerm),
    }));

    // Load snapshots once on mount
    useEffect(() => {
      fetchSnapshots();
    }, []);

    // Fetch holders whenever search term or snapshot selection changes
    useEffect(() => {
      const abortController = new AbortController();
      fetchHolders(searchTerm, abortController.signal);
      return () => abortController.abort();
    }, [searchTerm, selectedSnapshotId]);

    const fetchSnapshots = async () => {
      try {
        // @ts-ignore - fetchNftSnapshots exists at runtime but TypeScript doesn't recognize it
        const data = await API.fetchNftSnapshots();
        setSnapshots(data);
      } catch (error: any) {
        console.error('Error fetching snapshots:', error);
        onError(`Failed to fetch snapshots: ${error.message || 'Unknown error'}`);
      }
    };

    const fetchHolders = async (searchTermValue = searchTerm, signal?: AbortSignal) => {
      try {
        setLoading(true);
        // @ts-ignore - fetchNftHolders accepts a snapshotId parameter but TypeScript doesn't recognize it
        const data = await API.fetchNftHolders(searchTermValue, selectedSnapshotId, { signal });
        setHolders(data);
      } catch (error: any) {
        if (error.name === 'AbortError') return; // Silently ignore aborted requests
        console.error('Error fetching holders:', error);
        onError(`Failed to fetch holders: ${error.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    const takeSnapshot = async () => {
      try {
        setLoading(true);
        const data = await API.takeNftSnapshot();
        setHolders(data.holders);
        // Refresh snapshots after taking a new one
        await fetchSnapshots();
        // Select the most recent snapshot (latest)
        setSelectedSnapshotId(null);
        onSuccess('NFT snapshot taken successfully');
      } catch (error: any) {
        console.error('Error taking snapshot:', error);
        onError(`Failed to take snapshot: ${error.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    // Snapshot selector component
    const snapshotSelector = () => {
      if (snapshots.length === 0) return null;

      const options = snapshots.map(snapshot => ({
        label: `${new Date(snapshot.timestamp).toLocaleString()} (ID: ${snapshot.id})`,
        value: snapshot.id,
      }));

      // Add an option for the latest snapshot
      options.unshift({
        label: 'Latest Snapshot',
        value: null,
      });

      return (
        <div className="flex align-items-center mr-3">
          <span className="font-medium mr-2">Snapshot:</span>
          <Dropdown
            value={selectedSnapshotId}
            options={options}
            onChange={e => {
              setSelectedSnapshotId(e.value);
            }}
            placeholder="Latest Snapshot"
          />
        </div>
      );
    };

    // Table columns and templates
    const addressTemplate = (rowData: NFTHolder) => (
      <WalletAddress address={rowData.address} showExternalLink={true} showCopyIcon={true} />
    );

    const rowExpansionTemplate = (holder: NFTHolder) => (
      <div className="nft-list">
        {holder.nfts.map((nft, index) => (
          <a
            key={index}
            href={`https://solscan.io/token/${nft.mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`nft-item ${nft.type.toLowerCase()}`}
            style={{ textDecoration: 'none', cursor: 'pointer' }}
          >
            {nft.name}
          </a>
        ))}
      </div>
    );

    const socialActionsTemplate = (rowData: NFTHolder) => (
      <Button
        icon="pi pi-user-edit"
        className="p-button-rounded p-button-text"
        onClick={() => onShowSocialDialog(rowData)}
        tooltip="Add social info"
      />
    );

    const socialTemplate = (rowData: NFTHolder) => {
      // Priority: comment > twitter > discord
      if (rowData.comment) {
        return (
          <span title={`${rowData.twitter || ''} ${rowData.discord || ''}`}>{rowData.comment}</span>
        );
      }

      if (rowData.twitter) {
        return (
          <a
            href={`https://x.com/${rowData.twitter.replace('@', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="social-link"
          >
            <XIcon width={16} height={16} style={{ marginRight: 6 }} />
            {rowData.twitter}
          </a>
        );
      }

      if (rowData.discord) {
        return <span>{rowData.discord}</span>;
      }

      return <span>-</span>;
    };

    const getRowClassName = (rowData: NFTHolder) => {
      return {
        'highlight-row': rowData.nftCount >= 5,
        'whale-row': rowData.nftCount >= 10,
        'has-social-profile': rowData.twitter || rowData.discord || rowData.comment,
      };
    };

    // Footer template for summary
    const footerTemplate = () => (
      <div className="flex justify-between">
        <div>
          <strong>Total Holders:</strong> {holders.length}
        </div>
        <div>
          <strong>Total NFTs:</strong> {holders.reduce((acc, holder) => acc + holder.nftCount, 0)}
        </div>
        <div>
          <strong>Gen1:</strong> {holders.reduce((acc, holder) => acc + holder.gen1Count, 0)}
        </div>
        <div>
          <strong>Infant:</strong> {holders.reduce((acc, holder) => acc + holder.infantCount, 0)}
        </div>
      </div>
    );

    return (
      <div className="nft-holders">
        <div className="flex justify-between items-center mb-3 table-header">
          <h3 className="m-0">NFT Holders: {holders.length}</h3>
          <div className="flex gap-2 items-center">
            {snapshotSelector()}
            <SearchBar placeholder="Search NFT holders..." />
            <Button
              label="Take New Snapshot"
              icon="pi pi-refresh"
              onClick={takeSnapshot}
              loading={loading}
            />
          </div>
        </div>

        <DataTable
          value={holders}
          expandedRows={expandedRows}
          onRowToggle={e => setExpandedRows(e.data)}
          rowExpansionTemplate={rowExpansionTemplate}
          dataKey="address"
          rowClassName={getRowClassName}
          paginator
          rows={10}
          loading={loading}
          emptyMessage="No holders found"
          className="p-datatable-sm"
          footer={footerTemplate}
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={e => {
            setSortField(e.sortField);
            setSortOrder(e.sortOrder === 1 ? 1 : -1);
          }}
        >
          <Column expander style={{ width: '3rem' }} />
          <Column field="address" header="Wallet" body={addressTemplate} sortable />
          <Column field="nftCount" header="NFTs" sortable />
          <Column field="gen1Count" header="Gen1" sortable />
          <Column field="infantCount" header="Infant" sortable />
          <Column field="social" header="Social" body={socialTemplate} sortable />
          <Column body={socialActionsTemplate} style={{ width: '4rem' }} />
        </DataTable>
      </div>
    );
  }
);

export default NftHolders;
