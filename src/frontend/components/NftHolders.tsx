import React, { useState, useEffect } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { NFTHolder } from '../../types/index.js';
import { fetchNftHolders, takeNftSnapshot } from '../services/api.js';
import SearchBar from './SearchBar.js';

interface NftHoldersProps {
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  onShowSocialDialog: (holder: NFTHolder) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

const NftHolders: React.FC<NftHoldersProps> = ({ 
  onError, 
  onSuccess, 
  onShowSocialDialog,
  searchTerm,
  onSearchChange
}) => {
  const [holders, setHolders] = useState<NFTHolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<any>(null);
  const [sortField, setSortField] = useState('nftCount');
  const [sortOrder, setSortOrder] = useState<1 | -1>(-1);

  useEffect(() => {
    fetchHolders();
  }, [searchTerm]);

  const fetchHolders = async () => {
    try {
      setLoading(true);
      const data = await fetchNftHolders(searchTerm);
      setHolders(data);
    } catch (error: any) {
      console.error('Error fetching holders:', error);
      onError(`Failed to fetch holders: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const takeSnapshot = async () => {
    try {
      setLoading(true);
      const data = await takeNftSnapshot();
      setHolders(data.holders);
      onSuccess('NFT snapshot taken successfully');
    } catch (error: any) {
      console.error('Error taking snapshot:', error);
      onError(`Failed to take snapshot: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Table columns and templates
  const addressTemplate = (rowData: NFTHolder) => (
    <a 
      href={`https://solscan.io/account/${rowData.address}`}
      target="_blank" 
      rel="noopener noreferrer"
      className="wallet-link"
    >
      {rowData.address}
    </a>
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
      return <span title={`${rowData.twitter || ''} ${rowData.discord || ''}`}>{rowData.comment}</span>;
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

  const getRowClassName = (rowData: NFTHolder) => {
    return {
      'highlight-row': rowData.nftCount >= 5,
      'whale-row': rowData.nftCount >= 10,
      'has-social-profile': rowData.twitter || rowData.discord || rowData.comment
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
          <SearchBar 
            searchTerm={searchTerm} 
            onSearchChange={onSearchChange} 
            placeholder="Search NFT holders..."
          />
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
        onRowToggle={(e) => setExpandedRows(e.data)}
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
        onSort={(e) => {
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
};

export default NftHolders;

 