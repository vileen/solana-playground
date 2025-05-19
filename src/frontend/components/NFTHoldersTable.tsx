import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import React from 'react';

interface NFTHoldersTableProps {
  holders: any[];
  loading: boolean;
  onShowSocialDialog?: (holder: any) => void;
}

const NFTHoldersTable: React.FC<NFTHoldersTableProps> = ({ 
  holders, 
  loading,
  onShowSocialDialog
}) => {
  const addressTemplate = (rowData: any) => {
    return (
      <div className="flex align-items-center">
        <span>{rowData.address}</span>
      </div>
    );
  };

  const nftCountTemplate = (rowData: any) => {
    return (
      <span>{rowData.nftCount}</span>
    );
  };

  const actionsTemplate = (rowData: any) => {
    return (
      <div className="flex gap-2">
        <button 
          className="p-button p-button-sm p-button-outlined"
          onClick={() => onShowSocialDialog && onShowSocialDialog(rowData)}
        >
          Edit Social
        </button>
      </div>
    );
  };

  return (
    <DataTable 
      value={holders} 
      loading={loading}
      paginator 
      rows={10}
      rowsPerPageOptions={[10, 25, 50]}
      emptyMessage="No NFT holders found"
    >
      <Column field="address" header="Wallet Address" body={addressTemplate} sortable />
      <Column field="nftCount" header="NFTs Owned" body={nftCountTemplate} sortable />
      <Column header="Actions" body={actionsTemplate} style={{ width: '150px' }} />
    </DataTable>
  );
};

export default NFTHoldersTable; 