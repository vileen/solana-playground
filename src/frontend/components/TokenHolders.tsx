import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';

import { TokenHolder } from '../../types/index.js';
import { fetchTokenHolders, fetchTokenSnapshots, takeTokenSnapshot } from '../services/api.js';

import SearchBar from './SearchBar.js';

interface TokenHoldersProps {
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  onShowSocialDialog: (holder: TokenHolder) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

// Use forwardRef to expose methods to parent component
const TokenHolders = forwardRef<{ fetchHolders: () => Promise<void> }, TokenHoldersProps>(
  ({ onError, onSuccess, onShowSocialDialog, searchTerm, onSearchChange }, ref) => {
    const [holders, setHolders] = useState<TokenHolder[]>([]);
    const [loading, setLoading] = useState(false);
    const [sortField, setSortField] = useState('balance');
    const [sortOrder, setSortOrder] = useState<1 | -1>(-1);
    const [snapshots, setSnapshots] = useState<any[]>([]);
    const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      fetchHolders,
    }));

    useEffect(() => {
      fetchSnapshots();
      fetchHolders();
    }, [searchTerm, selectedSnapshotId]);

    const fetchSnapshots = async () => {
      try {
        const data = await fetchTokenSnapshots();
        setSnapshots(data);
      } catch (error: any) {
        console.error('Error fetching snapshots:', error);
        onError(`Failed to fetch snapshots: ${error.message || 'Unknown error'}`);
      }
    };

    const fetchHolders = async () => {
      try {
        setLoading(true);
        // Convert null to undefined for the API call
        const snapshotIdParam = selectedSnapshotId === null ? undefined : selectedSnapshotId;
        const data = await fetchTokenHolders(searchTerm, snapshotIdParam);
        setHolders(data);
      } catch (error: any) {
        console.error('Error fetching token holders:', error);
        onError(`Failed to fetch token holders: ${error.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    const takeSnapshot = async () => {
      try {
        setLoading(true);
        const data = await takeTokenSnapshot();
        setHolders(data.holders);
        // Refresh snapshots after taking a new one
        await fetchSnapshots();
        // Select the most recent snapshot (latest)
        setSelectedSnapshotId(null);
        onSuccess('Token snapshot taken successfully');
      } catch (error: any) {
        console.error('Error taking token snapshot:', error);
        onError(`Failed to take token snapshot: ${error.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    // Snapshot selector component
    const snapshotSelector = () => {
      if (snapshots.length === 0) return null;

      const options = snapshots.map(snapshot => ({
        label: `${new Date(snapshot.timestamp).toLocaleString()} (ID: ${snapshot.id})`,
        value: snapshot.id
      }));

      // Add an option for the latest snapshot
      options.unshift({
        label: 'Latest Snapshot',
        value: null
      });

      return (
        <div className="flex align-items-center mr-3">
          <span className="font-medium mr-2">Snapshot:</span>
          <Dropdown
            value={selectedSnapshotId}
            options={options}
            onChange={(e) => {
              setSelectedSnapshotId(e.value);
            }}
            placeholder="Latest Snapshot"
          />
        </div>
      );
    };

    // Table columns and templates
    const addressTemplate = (rowData: TokenHolder) => (
      <a
        href={`https://solscan.io/account/${rowData.address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="wallet-link"
      >
        {rowData.address}
      </a>
    );

    const socialActionsTemplate = (rowData: TokenHolder) => (
      <Button
        icon="pi pi-user-edit"
        className="p-button-rounded p-button-text"
        onClick={() => onShowSocialDialog(rowData)}
        tooltip="Add social info"
      />
    );

    const socialTemplate = (rowData: TokenHolder) => {
      // Priority: comment > twitter > discord
      if (rowData.comment) {
        return (
          <span title={`${rowData.twitter || ''} ${rowData.discord || ''}`}>{rowData.comment}</span>
        );
      }

      if (rowData.twitter) {
        return (
          <a
            href={`https://twitter.com/${rowData.twitter.replace('@', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="social-link"
          >
            {rowData.twitter}
          </a>
        );
      }

      if (rowData.discord) {
        return <span>{rowData.discord}</span>;
      }

      return <span>-</span>;
    };

    const tokenBalanceTemplate = (rowData: TokenHolder) => {
      return formatTokenBalance(rowData.balance);
    };

    const formatTokenBalance = (value: number) => {
      return value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    const getRowClassName = (rowData: TokenHolder) => {
      return {
        'highlight-row': rowData.balance >= 10000,
        'whale-row': rowData.balance >= 100000,
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
          <strong>Total Tokens:</strong>{' '}
          {formatTokenBalance(holders.reduce((acc, holder) => acc + holder.balance, 0))}
        </div>
        <div>
          <strong>Avg Per Holder:</strong>{' '}
          {holders.length
            ? formatTokenBalance(
                holders.reduce((acc, holder) => acc + holder.balance, 0) / holders.length
              )
            : '0.00'}
        </div>
      </div>
    );

    return (
      <div className="token-holders">
        <div className="flex justify-between items-center mb-3 table-header">
          <h3 className="m-0">Token Holders: {holders.length}</h3>
          <div className="flex gap-2 items-center">
            {snapshotSelector()}
            <SearchBar
              searchTerm={searchTerm}
              onSearchChange={onSearchChange}
              placeholder="Search token holders..."
            />
            <Button
              label="Take New Snapshot"
              icon="pi pi-camera"
              onClick={takeSnapshot}
              loading={loading}
            />
          </div>
        </div>

        <DataTable
          value={holders}
          dataKey="address"
          rowClassName={getRowClassName}
          paginator
          rows={10}
          loading={loading}
          emptyMessage="No token holders found"
          className="p-datatable-sm"
          footer={footerTemplate}
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={e => {
            setSortField(e.sortField);
            setSortOrder(e.sortOrder === 1 ? 1 : -1);
          }}
        >
          <Column field="address" header="Wallet" body={addressTemplate} sortable />
          <Column field="balance" header="Balance" body={tokenBalanceTemplate} sortable />
          <Column field="social" header="Social" body={socialTemplate} sortable />
          <Column body={socialActionsTemplate} style={{ width: '4rem' }} />
        </DataTable>
      </div>
    );
  }
);

export default TokenHolders;
