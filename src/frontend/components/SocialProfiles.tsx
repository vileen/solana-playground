import React, { useState, useEffect } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { fetchNftHolders, fetchTokenHolders, fetchSocialProfiles } from '../services/api.js';
import SearchBar from './SearchBar.js';

interface SocialProfilesProps {
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  onShowSocialDialog: (holder: any) => void;
}

const SocialProfiles: React.FC<SocialProfilesProps> = ({
  onError,
  onSuccess,
  onShowSocialDialog
}) => {
  const [socialHolders, setSocialHolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadSocialProfiles();
  }, [searchTerm]);

  const loadSocialProfiles = async () => {
    try {
      setLoading(true);
      
      // First fetch social profiles to get the base data
      const profiles = await fetchSocialProfiles();
      
      // Then fetch NFT and token data to combine
      const nftHolders = await fetchNftHolders();
      const tokenHolders = await fetchTokenHolders();
      
      // Create maps for quick lookups
      const tokenMap = new Map();
      tokenHolders.forEach(holder => {
        tokenMap.set(holder.address, holder.balance);
      });
      
      const nftMap = new Map();
      nftHolders.forEach(holder => {
        // Ensure we're capturing the correct count values
        nftMap.set(holder.address, {
          gen1Count: holder.gen1Count || 0,
          infantCount: holder.infantCount || 0,
          nftCount: holder.nftCount || 0
        });
      });
      
      // Combine all data - start with profiles
      const combinedData = profiles.map((profile: any) => {
        const nftData = nftMap.get(profile.address) || { gen1Count: 0, infantCount: 0, nftCount: 0 };
        
        return {
          address: profile.address,
          socialProfiles: {
            twitter: profile.twitter,
            discord: profile.discord,
            comment: profile.comment
          },
          tokenBalance: tokenMap.get(profile.address) || 0,
          gen1Count: nftData.gen1Count,
          infantCount: nftData.infantCount,
          nftCount: nftData.nftCount
        };
      });
      
      // Filter if search term is provided
      let filteredData = combinedData;
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filteredData = combinedData.filter(holder => 
          holder.address.toLowerCase().includes(searchLower) ||
          holder.socialProfiles?.twitter?.toLowerCase().includes(searchLower) ||
          holder.socialProfiles?.discord?.toLowerCase().includes(searchLower) ||
          holder.socialProfiles?.comment?.toLowerCase().includes(searchLower)
        );
      }
      
      setSocialHolders(filteredData);
    } catch (error: any) {
      onError(`Error loading social profiles: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Table templates
  const addressTemplate = (rowData: any) => (
    <a 
      href={`https://solscan.io/account/${rowData.address}`}
      target="_blank" 
      rel="noopener noreferrer"
      className="wallet-link"
    >
      {rowData.address.substring(0, 4)}...{rowData.address.substring(rowData.address.length - 4)}
    </a>
  );
  
  const twitterTemplate = (rowData: any) => {
    if (!rowData.socialProfiles?.twitter) return <span>N/A</span>;
    return (
      <a 
        href={`https://twitter.com/${rowData.socialProfiles.twitter.replace('@', '')}`} 
        target="_blank" 
        rel="noopener noreferrer"
        className="social-link"
      >
        {rowData.socialProfiles.twitter}
      </a>
    );
  };
  
  const discordTemplate = (rowData: any) => {
    return rowData.socialProfiles?.discord || 'N/A';
  };
  
  const socialTemplate = (rowData: any) => {
    // Priority: comment > twitter > discord
    const tooltipContent = `${rowData.socialProfiles?.twitter || ''} ${rowData.socialProfiles?.discord || ''}`.trim();
    
    if (rowData.socialProfiles?.comment) {
      return (
        <span 
          title={tooltipContent}
          className="social-comment"
        >
          {rowData.socialProfiles.comment}
        </span>
      );
    }
    
    if (rowData.socialProfiles?.twitter) {
      return (
        <a 
          href={`https://twitter.com/${rowData.socialProfiles.twitter.replace('@', '')}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="social-link twitter-link"
        >
          {rowData.socialProfiles.twitter}
        </a>
      );
    }
    
    if (rowData.socialProfiles?.discord) {
      return <span className="discord-tag">{rowData.socialProfiles.discord}</span>;
    }
    
    return <span>N/A</span>;
  };
  
  const socialActionsTemplate = (rowData: any) => (
    <Button 
      icon="pi pi-user-edit" 
      className="p-button-rounded p-button-text" 
      onClick={() => onShowSocialDialog({
        address: rowData.address,
        twitter: rowData.socialProfiles?.twitter,
        discord: rowData.socialProfiles?.discord,
        comment: rowData.socialProfiles?.comment
      })} 
      tooltip="Edit social info"
    />
  );
  
  const formatTokenBalance = (value: number) => {
    return value ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0';
  };
  
  const getRowClassName = (rowData: any) => {
    return {
      'highlight-row': rowData.nftCount >= 5 || rowData.tokenBalance >= 10000,
      'whale-row': rowData.nftCount >= 10 || rowData.tokenBalance >= 100000
    };
  };

  // Footer template for summary
  const footerTemplate = () => (
    <div className="flex justify-between">
      <div>
        <strong>Total Profiles:</strong> {socialHolders.length}
      </div>
      <div>
        <strong>With Twitter:</strong> {socialHolders.filter(h => h.socialProfiles?.twitter).length}
      </div>
      <div>
        <strong>With Discord:</strong> {socialHolders.filter(h => h.socialProfiles?.discord).length}
      </div>
      <div>
        <strong>With Comments:</strong> {socialHolders.filter(h => h.socialProfiles?.comment).length}
      </div>
    </div>
  );

  return (
    <div className="social-profiles">
      <div className="flex justify-between items-center mb-3 table-header">
        <h3 className="m-0">Social Profiles: {socialHolders.length}</h3>
        <div className="flex gap-2 items-center">
          <SearchBar 
            searchTerm={searchTerm} 
            onSearchChange={setSearchTerm} 
            placeholder="Search social profiles..."
          />
          <Button 
            label="Refresh Data" 
            icon="pi pi-refresh" 
            onClick={loadSocialProfiles} 
            loading={loading}
          />
        </div>
      </div>
      <DataTable
        value={socialHolders}
        loading={loading}
        paginator
        rows={10}
        dataKey="address"
        className="p-datatable-sm"
        rowClassName={getRowClassName}
        footer={footerTemplate}
      >
        <Column
          field="address"
          header="Wallet Address"
          body={addressTemplate}
          sortable
        />
        <Column
          field="socialProfiles.twitter"
          header="Twitter"
          body={twitterTemplate}
          sortable
        />
        <Column
          field="socialProfiles.discord"
          header="Discord"
          body={discordTemplate}
          sortable
        />
        <Column
          field="socialProfiles.comment"
          header="Comment"
          body={socialTemplate}
          sortable
        />
        <Column
          field="tokenBalance"
          header="Token Balance"
          body={(rowData) => formatTokenBalance(rowData.tokenBalance)}
          sortable
        />
        <Column
          field="gen1Count"
          header="Gen1 Count"
          sortable
        />
        <Column
          field="infantCount"
          header="Infant Count"
          sortable
        />
        <Column
          field="nftCount"
          header="Total NFTs"
          sortable
        />
        <Column
          body={socialActionsTemplate}
          style={{ width: '5em' }}
          header="Actions"
        />
      </DataTable>
    </div>
  );
};

export default SocialProfiles; 