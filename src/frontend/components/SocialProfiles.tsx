import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { fetchNftHolders, fetchTokenHolders, fetchSocialProfiles, saveSocialProfile as apiSaveSocialProfile, deleteSocialProfile as apiDeleteSocialProfile } from '../services/api.js';
import SearchBar from './SearchBar.js';
import ProfileDialog from './ProfileDialog.js';

interface SocialProfilesProps {
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  onShowSocialDialog: (holder: any) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

interface WalletData {
  address: string;
  tokenBalance: number;
  gen1Count: number;
  infantCount: number;
  nftCount: number;
}

interface GroupedSocialProfile {
  id: string;
  displayName: string;
  twitter: string | null;
  discord: string | null;
  comment: string | null;
  wallets: WalletData[];
  totalTokenBalance: number;
  totalGen1Count: number;
  totalInfantCount: number;
  totalNftCount: number;
}

// Use forwardRef to expose methods to parent component
const SocialProfiles = forwardRef<{ loadSocialProfiles: () => Promise<void> }, SocialProfilesProps>(({
  onError,
  onSuccess,
  onShowSocialDialog,
  searchTerm,
  onSearchChange
}, ref) => {
  const [socialProfiles, setSocialProfiles] = useState<GroupedSocialProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<any>(null);
  const [profileDialogVisible, setProfileDialogVisible] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    loadSocialProfiles
  }));

  useEffect(() => {
    loadSocialProfiles();
  }, [searchTerm]);

  const loadSocialProfiles = async () => {
    try {
      setLoading(true);
      
      // Fetch all data
      const profiles = await fetchSocialProfiles();
      const nftHolders = await fetchNftHolders();
      const tokenHolders = await fetchTokenHolders();
      
      // Create maps for quick lookups
      const tokenMap = new Map();
      tokenHolders.forEach(holder => {
        tokenMap.set(holder.address, holder.balance);
      });
      
      const nftMap = new Map();
      nftHolders.forEach(holder => {
        nftMap.set(holder.address, {
          gen1Count: holder.gen1Count || 0,
          infantCount: holder.infantCount || 0,
          nftCount: holder.nftCount || 0
        });
      });
      
      // Group wallets by social identity
      const groupedProfiles = new Map<string, GroupedSocialProfile>();
      
      profiles.forEach(profile => {
        // Get the actual backend ID, or fall back to a content identifier
        const profileId = profile.id || (profile.twitter || profile.discord || profile.comment);
        
        if (!profileId) {
          // Skip profiles with no ID or social info (shouldn't happen)
          return;
        }
        
        // Fetch NFT and token data for this wallet
        const nftData = nftMap.get(profile.address) || { gen1Count: 0, infantCount: 0, nftCount: 0 };
        const tokenBalance = tokenMap.get(profile.address) || 0;
        
        // Prepare wallet data
        const walletData: WalletData = {
          address: profile.address,
          tokenBalance,
          gen1Count: nftData.gen1Count,
          infantCount: nftData.infantCount,
          nftCount: nftData.nftCount
        };
        
        // Create or update the grouped profile
        if (groupedProfiles.has(profileId)) {
          // Add this wallet to existing profile
          const existingProfile = groupedProfiles.get(profileId)!;
          existingProfile.wallets.push(walletData);
          existingProfile.totalTokenBalance += tokenBalance;
          existingProfile.totalGen1Count += nftData.gen1Count;
          existingProfile.totalInfantCount += nftData.infantCount;
          existingProfile.totalNftCount += nftData.nftCount;
          
          // Update the profile if this wallet has a comment and the profile doesn't
          if (profile.comment && !existingProfile.comment) {
            existingProfile.comment = profile.comment;
          }
        } else {
          // Create a new profile group
          const displayName = profile.comment || profile.twitter || profile.discord || 'Unknown';
          groupedProfiles.set(profileId, {
            id: profileId,
            displayName,
            twitter: profile.twitter,
            discord: profile.discord,
            comment: profile.comment,
            wallets: [walletData],
            totalTokenBalance: tokenBalance,
            totalGen1Count: nftData.gen1Count,
            totalInfantCount: nftData.infantCount,
            totalNftCount: nftData.nftCount
          });
        }
      });
      
      // Convert map to array
      const groupedProfilesArray = Array.from(groupedProfiles.values());
      
      // Filter by search term if provided
      let filteredProfiles = groupedProfilesArray;
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filteredProfiles = groupedProfilesArray.filter(profile => 
          profile.displayName.toLowerCase().includes(searchLower) ||
          (profile.twitter?.toLowerCase().includes(searchLower) || false) ||
          (profile.discord?.toLowerCase().includes(searchLower) || false) ||
          (profile.comment?.toLowerCase().includes(searchLower) || false) ||
          profile.wallets.some(wallet => wallet.address.toLowerCase().includes(searchLower))
        );
      }
      
      setSocialProfiles(filteredProfiles);
    } catch (error: any) {
      onError(`Error loading social profiles: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const openNewProfileDialog = () => {
    setSelectedProfile(null);
    setProfileDialogVisible(true);
  };

  const openEditProfileDialog = (profile: GroupedSocialProfile) => {
    setSelectedProfile(profile);
    setProfileDialogVisible(true);
  };

  const handleSaveProfile = async (profileData: any) => {
    try {
      setLoading(true);
      // If there are no wallets in the data, show an error
      if (!profileData.wallets || profileData.wallets.length === 0) {
        onError('At least one wallet address is required');
        setLoading(false);
        return;
      }
      
      // Call the API with the correct parameter
      const result = await apiSaveSocialProfile(profileData);
      
      setProfileDialogVisible(false);
      await loadSocialProfiles();
      onSuccess(profileData.id ? 'Profile updated successfully' : 'New profile created successfully');
    } catch (error: any) {
      onError(`Failed to save profile: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Add a new method to handle profile deletion
  const handleDeleteProfile = async (profileId: string) => {
    try {
      setLoading(true);
      
      const result = await apiDeleteSocialProfile(profileId);
      
      setProfileDialogVisible(false);
      await loadSocialProfiles();
      onSuccess('Profile deleted successfully');
    } catch (error: any) {
      onError(`Failed to delete profile: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Row expansion template to show wallet details
  const rowExpansionTemplate = (data: GroupedSocialProfile) => (
    <div className="wallet-details p-3">
      <h4 className="mb-3">Wallets: {data.wallets.length}</h4>
      <DataTable 
        value={data.wallets} 
        className="p-datatable-sm" 
        size="small"
        dataKey="address"
      >
        <Column 
          field="address" 
          header="Wallet Address" 
          body={(wallet: WalletData) => (
            <a 
              href={`https://solscan.io/account/${wallet.address}`}
              target="_blank" 
              rel="noopener noreferrer"
              className="wallet-link"
            >
              {wallet.address.substring(0, 8)}...{wallet.address.substring(wallet.address.length - 8)}
            </a>
          )} 
        />
        <Column 
          field="tokenBalance" 
          header="Token Balance" 
          body={(wallet: WalletData) => formatTokenBalance(wallet.tokenBalance)} 
        />
        <Column field="gen1Count" header="Gen1 Count" />
        <Column field="infantCount" header="Infant Count" />
        <Column field="nftCount" header="Total NFTs" />
        <Column 
          body={(wallet: WalletData) => (
            <a 
              href={`https://solscan.io/account/${wallet.address}`}
              target="_blank" 
              rel="noopener noreferrer"
              className="p-button p-button-text p-button-sm"
            >
              <i className="pi pi-external-link" />
            </a>
          )} 
          style={{ width: '4rem' }}
        />
      </DataTable>
    </div>
  );

  // Main table templates
  const primaryIdentifierTemplate = (rowData: GroupedSocialProfile) => {
    // Priority: comment > twitter > discord
    if (rowData.comment) {
      return <span className="social-comment">{rowData.comment}</span>;
    }
    
    if (rowData.twitter) {
      return (
        <a 
          href={`https://twitter.com/${rowData.twitter.replace('@', '')}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="social-link twitter-link"
        >
          {rowData.twitter}
        </a>
      );
    }
    
    if (rowData.discord) {
      return <span className="discord-tag">{rowData.discord}</span>;
    }
    
    return <span>Unknown</span>;
  };
  
  const twitterTemplate = (rowData: GroupedSocialProfile) => {
    if (!rowData.twitter) return <span>-</span>;
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
  };
  
  const discordTemplate = (rowData: GroupedSocialProfile) => {
    return rowData.discord || '-';
  };
  
  const walletsCountTemplate = (rowData: GroupedSocialProfile) => {
    return <span className="font-bold">{rowData.wallets.length}</span>;
  };
  
  const formatTokenBalance = (value: number) => {
    return value ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0';
  };
  
  const socialActionsTemplate = (rowData: GroupedSocialProfile) => (
    <Button 
      icon="pi pi-user-edit" 
      className="p-button-rounded p-button-text" 
      onClick={() => openEditProfileDialog(rowData)} 
      tooltip="Edit social info"
    />
  );
  
  const getRowClassName = (rowData: GroupedSocialProfile) => {
    return {
      'highlight-row': rowData.totalNftCount >= 5 || rowData.totalTokenBalance >= 10000,
      'whale-row': rowData.totalNftCount >= 10 || rowData.totalTokenBalance >= 100000
    };
  };

  // Footer template for summary
  const footerTemplate = () => (
    <div className="flex justify-between">
      <div>
        <strong>Total Profiles:</strong> {socialProfiles.length}
      </div>
      <div>
        <strong>Total Wallets:</strong> {socialProfiles.reduce((acc, profile) => acc + profile.wallets.length, 0)}
      </div>
      <div>
        <strong>Total NFTs:</strong> {socialProfiles.reduce((acc, profile) => acc + profile.totalNftCount, 0)}
      </div>
      <div>
        <strong>Total Tokens:</strong> {formatTokenBalance(socialProfiles.reduce((acc, profile) => acc + profile.totalTokenBalance, 0))}
      </div>
    </div>
  );

  return (
    <div className="social-profiles">
      <div className="flex justify-between items-center mb-3 table-header">
        <h3 className="m-0">Social Profiles: {socialProfiles.length}</h3>
        <div className="flex gap-2 items-center">
          <SearchBar 
            searchTerm={searchTerm} 
            onSearchChange={onSearchChange} 
            placeholder="Search social profiles..."
          />
          <Button 
            label="Add Profile" 
            icon="pi pi-plus" 
            onClick={openNewProfileDialog} 
            className="p-button-success"
          />
          <Button 
            label="Refresh" 
            icon="pi pi-refresh" 
            onClick={loadSocialProfiles} 
            loading={loading}
          />
        </div>
      </div>
      <DataTable
        value={socialProfiles}
        loading={loading}
        paginator
        rows={10}
        dataKey="id"
        expandedRows={expandedRows}
        onRowToggle={(e) => setExpandedRows(e.data)}
        rowExpansionTemplate={rowExpansionTemplate}
        className="p-datatable-sm"
        rowClassName={getRowClassName}
        footer={footerTemplate}
      >
        <Column expander style={{ width: '3rem' }} />
        <Column
          field="displayName"
          header="Identity"
          body={primaryIdentifierTemplate}
          sortable
        />
        <Column
          field="twitter"
          header="Twitter"
          body={twitterTemplate}
          sortable
        />
        <Column
          field="discord"
          header="Discord"
          body={discordTemplate}
          sortable
        />
        <Column
          field="wallets"
          header="Wallets"
          body={walletsCountTemplate}
          sortable
        />
        <Column
          field="totalTokenBalance"
          header="Total Tokens"
          body={(rowData) => formatTokenBalance(rowData.totalTokenBalance)}
          sortable
        />
        <Column
          field="totalGen1Count"
          header="Total Gen1"
          sortable
        />
        <Column
          field="totalInfantCount"
          header="Total Infant"
          sortable
        />
        <Column
          field="totalNftCount"
          header="Total NFTs"
          sortable
        />
        <Column
          body={socialActionsTemplate}
          style={{ width: '5em' }}
          header="Actions"
        />
      </DataTable>
      
      <ProfileDialog 
        visible={profileDialogVisible}
        onHide={() => setProfileDialogVisible(false)}
        onSave={handleSaveProfile}
        onDelete={handleDeleteProfile}
        profile={selectedProfile}
      />
    </div>
  );
});

export default SocialProfiles; 