import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';

import { useAppNavigation } from '../hooks/useAppNavigation.js';
import {
  deleteSocialProfile as apiDeleteSocialProfile,
  saveSocialProfile as apiSaveSocialProfile,
  fetchNftHolders,
  fetchSocialProfiles,
  fetchStakingData,
  fetchTokenHolders,
} from '../services/api.js';

import ProfileDialog from './ProfileDialog.js';
import SearchBar from './SearchBar.js';
import WalletAddress from './WalletAddress.js';
import XIcon from './XIcon.js';

interface SocialProfilesProps {
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

interface WalletData {
  address: string;
  tokenBalance: number;
  gen1Count: number;
  infantCount: number;
  nftCount: number;
  stakingData?: {
    totalStaked: number;
    totalLocked: number;
    totalUnlocked: number;
  };
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
  totalStaked: number;
  totalLocked: number;
  totalUnlocked: number;
}

// Use forwardRef to expose methods to parent component
const SocialProfiles = forwardRef<{ loadSocialProfiles: () => Promise<void> }, SocialProfilesProps>(
  ({ onError, onSuccess, searchTerm, onSearchChange }, ref) => {
    const [socialProfiles, setSocialProfiles] = useState<GroupedSocialProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedRows, setExpandedRows] = useState<any>(null);
    const [profileDialogVisible, setProfileDialogVisible] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<any>(null);
    const appNavigation = useAppNavigation();
    // Add state for sorting
    const [sortField, setSortField] = useState<string>('totalTokenBalance');
    const [sortOrder, setSortOrder] = useState<1 | -1>(-1); // -1 for descending

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      loadSocialProfiles,
    }));

    useEffect(() => {
      loadSocialProfiles();
    }, [searchTerm]);

    const loadSocialProfiles = async () => {
      try {
        setLoading(true);

        // Step 1: Fetch social profiles first (this now returns all wallets for matching profiles)
        const profiles = await fetchSocialProfiles(searchTerm);

        // Step 2: Extract all wallet addresses from the social profiles
        const allWalletAddresses = profiles.map(profile => profile.address);

        // Step 3: If we have a search term, fetch balance data for ALL related wallets
        // If no search term, fetch all data without filtering
        let nftHolders, tokenHolders, stakingData;

        if (searchTerm && allWalletAddresses.length > 0) {
          // When searching, we need to get data for all wallets in the matching profiles
          // We'll fetch all data and then filter to our specific wallet addresses
          const [allNftHolders, allTokenHolders, allStakingData] = await Promise.all([
            fetchNftHolders(''), // Fetch all
            fetchTokenHolders(''), // Fetch all
            fetchStakingData(''), // Fetch all
          ]);

          // Filter to only include wallets from our social profiles
          const walletAddressSet = new Set(allWalletAddresses);
          nftHolders = allNftHolders.filter(holder => walletAddressSet.has(holder.address));
          tokenHolders = allTokenHolders.filter(holder => walletAddressSet.has(holder.address));
          stakingData = allStakingData.filter(stake => walletAddressSet.has(stake.walletAddress));
        } else {
          // No search term - fetch all data normally
          [nftHolders, tokenHolders, stakingData] = await Promise.all([
            fetchNftHolders(searchTerm),
            fetchTokenHolders(searchTerm),
            fetchStakingData(searchTerm),
          ]);
        }

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
            nftCount: holder.nftCount || 0,
          });
        });

        const stakingMap = new Map();
        stakingData.forEach(stake => {
          stakingMap.set(stake.walletAddress, {
            totalStaked: stake.totalStaked || 0,
            totalLocked: stake.totalLocked || 0,
            totalUnlocked: stake.totalUnlocked || 0,
          });
        });

        // Group wallets by social identity
        const groupedProfiles = new Map<string, GroupedSocialProfile>();

        profiles.forEach(profile => {
          // Get the actual backend ID, or fall back to a content identifier
          const profileId = profile.id || profile.twitter || profile.discord || profile.comment;

          if (!profileId) {
            // Skip profiles with no ID or social info (shouldn't happen)
            return;
          }

          // Fetch NFT, token, and staking data for this wallet
          const nftData = nftMap.get(profile.address) || {
            gen1Count: 0,
            infantCount: 0,
            nftCount: 0,
          };
          const tokenBalance = tokenMap.get(profile.address) || 0;
          const stakingInfo = stakingMap.get(profile.address) || {
            totalStaked: 0,
            totalLocked: 0,
            totalUnlocked: 0,
          };

          // Prepare wallet data
          const walletData: WalletData = {
            address: profile.address,
            tokenBalance,
            gen1Count: nftData.gen1Count,
            infantCount: nftData.infantCount,
            nftCount: nftData.nftCount,
            stakingData: stakingInfo,
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
            existingProfile.totalStaked += stakingInfo.totalStaked;
            existingProfile.totalLocked += stakingInfo.totalLocked;
            existingProfile.totalUnlocked += stakingInfo.totalUnlocked;

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
              totalNftCount: nftData.nftCount,
              totalStaked: stakingInfo.totalStaked,
              totalLocked: stakingInfo.totalLocked,
              totalUnlocked: stakingInfo.totalUnlocked,
            });
          }
        });

        // Convert map to array
        const groupedProfilesArray = Array.from(groupedProfiles.values());

        // Since we're already filtering on the backend, we don't need additional frontend filtering when there's a searchTerm
        // Only apply frontend filtering when there's no search term (i.e., when we're showing all data)
        let filteredProfiles = groupedProfilesArray;

        // Apply default sorting (prioritize tokens, then staking, then NFTs)
        filteredProfiles.sort((a, b) => {
          // First sort by totalTokenBalance
          if (a.totalTokenBalance !== b.totalTokenBalance) {
            return b.totalTokenBalance - a.totalTokenBalance; // Descending order
          }
          // Then sort by totalStaked
          if (a.totalStaked !== b.totalStaked) {
            return b.totalStaked - a.totalStaked; // Descending order
          }
          // Then sort by totalNftCount
          return b.totalNftCount - a.totalNftCount; // Descending order
        });

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
        onSuccess(
          profileData.id ? 'Profile updated successfully' : 'New profile created successfully'
        );
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

        await apiDeleteSocialProfile(profileId);

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
        <DataTable value={data.wallets} className="p-datatable-sm" size="small" dataKey="address">
          <Column
            field="address"
            header="Wallet Address"
            body={(wallet: WalletData) => (
              <div className="flex align-items-center">
                <WalletAddress
                  address={wallet.address}
                  shortened={true}
                  showExternalLink={true}
                  showCopyIcon={true}
                />
                <Button
                  icon="pi pi-pencil"
                  className="p-button-text p-button-rounded ml-2"
                  onClick={() => openEditProfileDialogWithWallet(data, wallet.address)}
                  tooltip="Edit profile"
                  style={{ padding: '0.25rem' }}
                />
              </div>
            )}
          />
          <Column
            field="tokenBalance"
            header="Token Balance"
            body={(wallet: WalletData) => formatTokenBalance(wallet.tokenBalance)}
          />
          <Column
            field="stakingData"
            header="Staked"
            body={(wallet: WalletData) =>
              wallet.stakingData ? formatTokenBalance(wallet.stakingData.totalStaked) : '0'
            }
          />
          <Column
            field="stakingData"
            header="Locked"
            body={(wallet: WalletData) =>
              wallet.stakingData ? formatTokenBalance(wallet.stakingData.totalLocked) : '0'
            }
          />
          <Column
            field="stakingData"
            header="Unlocked"
            body={(wallet: WalletData) =>
              wallet.stakingData ? formatTokenBalance(wallet.stakingData.totalUnlocked) : '0'
            }
          />
          <Column field="gen1Count" header="Gen1 Count" />
          <Column field="infantCount" header="Infant Count" />
          <Column field="nftCount" header="Total NFTs" />
          <Column
            body={(wallet: WalletData) => (
              <a
                href="#"
                onClick={e => {
                  e.preventDefault();
                  if (wallet.nftCount > 0) {
                    // Navigate to NFT holder table and apply wallet to search
                    appNavigation.navigateToNftHolders(wallet.address);
                  } else if (wallet.tokenBalance > 0) {
                    // Navigate to token holder table and apply wallet to search
                    appNavigation.navigateToTokenHolders(wallet.address);
                  }
                }}
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

    // Open profile dialog with specific wallet highlighted
    const openEditProfileDialogWithWallet = (
      profile: GroupedSocialProfile,
      walletAddress: string
    ) => {
      setSelectedProfile({
        ...profile,
        selectedWalletAddress: walletAddress,
      });
      setProfileDialogVisible(true);
    };

    // Main table templates
    const primaryIdentifierTemplate = (rowData: GroupedSocialProfile) => {
      // Priority: comment > twitter > discord
      if (rowData.comment) {
        return <span className="social-comment">{rowData.comment}</span>;
      }

      if (rowData.twitter) {
        return (
          <a
            href={`https://x.com/${rowData.twitter.replace('@', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="social-link twitter-link"
          >
            <XIcon width={16} height={16} style={{ marginRight: 6 }} />
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
          href={`https://x.com/${rowData.twitter.replace('@', '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="social-link"
        >
          <XIcon width={16} height={16} style={{ marginRight: 6 }} />
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
      return value
        ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0';
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
        'whale-row': rowData.totalNftCount >= 10 || rowData.totalTokenBalance >= 100000,
      };
    };

    // Footer template for summary
    const footerTemplate = () => (
      <div className="flex justify-between">
        <div>
          <strong>Total Profiles:</strong> {socialProfiles.length}
        </div>
        <div>
          <strong>Total Wallets:</strong>{' '}
          {socialProfiles.reduce((acc, profile) => acc + profile.wallets.length, 0)}
        </div>
        <div>
          <strong>Total NFTs:</strong>{' '}
          {socialProfiles.reduce((acc, profile) => acc + profile.totalNftCount, 0)}
        </div>
        <div>
          <strong>Total Tokens:</strong>{' '}
          {formatTokenBalance(
            socialProfiles.reduce((acc, profile) => acc + profile.totalTokenBalance, 0)
          )}
        </div>
        <div>
          <strong>Total Staked:</strong>{' '}
          {formatTokenBalance(
            socialProfiles.reduce((acc, profile) => acc + profile.totalStaked, 0)
          )}
        </div>
      </div>
    );

    // Handle sorting
    const handleSort = (e: any) => {
      if (e.sortField) {
        setSortField(e.sortField);
      }
      if (e.sortOrder !== undefined && e.sortOrder !== null) {
        setSortOrder(e.sortOrder as 1 | -1);
      }
    };

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
          onRowToggle={e => setExpandedRows(e.data)}
          rowExpansionTemplate={rowExpansionTemplate}
          className="p-datatable-sm"
          rowClassName={getRowClassName}
          footer={footerTemplate}
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={handleSort}
          removableSort={false}
        >
          <Column expander style={{ width: '3rem' }} />
          <Column field="displayName" header="Identity" body={primaryIdentifierTemplate} sortable />
          <Column field="twitter" header="X" body={twitterTemplate} sortable />
          <Column field="discord" header="Discord" body={discordTemplate} sortable />
          <Column field="wallets" header="Wallets" body={walletsCountTemplate} sortable />
          <Column
            field="totalTokenBalance"
            header="Total Tokens"
            body={rowData => formatTokenBalance(rowData.totalTokenBalance)}
            sortable
          />
          <Column
            field="totalStaked"
            header="GP Staking"
            body={rowData => formatTokenBalance(rowData.totalStaked)}
            sortable
          />
          <Column field="totalGen1Count" header="Total Gen1" sortable />
          <Column field="totalInfantCount" header="Total Infant" sortable />
          <Column field="totalNftCount" header="Total NFTs" sortable />
          <Column body={socialActionsTemplate} style={{ width: '5em' }} header="Actions" />
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
  }
);

export default SocialProfiles;
