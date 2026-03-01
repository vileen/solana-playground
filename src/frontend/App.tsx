import React, { useEffect, useRef, useState } from 'react';
import { HashRouter, useLocation } from 'react-router-dom';

import { Button } from 'primereact/button';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { TabPanel, TabView } from 'primereact/tabview';
import { Toast } from 'primereact/toast';

import './App.css';
import './TabViewFix.css';
import CombinedSnapshotsPanel from './components/CombinedSnapshotsPanel.js';
import EventsPanel from './components/EventsPanel.js';
import NftHolders from './components/NftHolders.js';
import ProfileDialog from './components/ProfileDialog.js';
import SocialProfiles from './components/SocialProfiles.js';
import StakingView from './components/StakingView.js';
import TokenHolders from './components/TokenHolders.js';
import { ROUTE_TO_TAB_INDEX, useAppNavigation } from './hooks/useAppNavigation.js';
import {
  deleteSocialProfile as apiDeleteSocialProfile,
  saveSocialProfile as apiSaveSocialProfile,
  fetchSocialProfiles,
} from './services/api.js';
import { getSavedTheme, loadThemeCSS, toggleTheme } from './utils/theme.js';

// Create a wrapper component that will handle route changes
const AppContent: React.FC = () => {
  const appNavigation = useAppNavigation();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState(() => appNavigation.getCurrentTabIndex());
  const [profileDialogVisible, setProfileDialogVisible] = useState(false);
  const [selectedHolder, setSelectedHolder] = useState<any>(null);
  const [selectedWalletAddress, setSelectedWalletAddress] = useState<string | undefined>(undefined);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // References to child components for refreshing
  const nftHoldersRef = useRef<any>(null);
  const tokenHoldersRef = useRef<any>(null);
  const socialProfilesRef = useRef<any>(null);

  const toast = useRef<Toast>(null);

  useEffect(() => {
    // Load saved theme preference
    const savedIsDarkMode = getSavedTheme();
    setIsDarkMode(savedIsDarkMode);
    loadThemeCSS(savedIsDarkMode);
  }, []);

  // Update active tab when URL pathname changes
  useEffect(() => {
    const path = location.pathname;
    const matchingEntry = Object.entries(ROUTE_TO_TAB_INDEX).find(
      ([route]) => path === route || path.startsWith(route + '/')
    );
    setActiveTab(matchingEntry ? matchingEntry[1] : 0);
  }, [location.pathname]);

  const handleThemeToggle = () => {
    setIsDarkMode(toggleTheme(isDarkMode));
  };

  // Handle tab change
  const handleTabChange = (e: { index: number }) => {
    // Navigate to the tab route — the useEffect above will update activeTab
    appNavigation.navigateToTab(e.index);
  };

  const showSocialDialog = async (holder: any) => {
    try {
      // If holder has an ID, we need to fetch the complete profile with all wallets
      if (holder.id) {
        const allProfiles = await fetchSocialProfiles();

        // Group profiles by ID to get all wallets for this profile
        const wallets: { address: string }[] = [];

        // Find all profile entries with this ID and collect wallets
        let profileTwitter = '';
        let profileDiscord = '';
        let profileComment = '';

        allProfiles.forEach((profile: any) => {
          if (profile.id === holder.id) {
            // Collect social info (should be the same for all entries with this ID)
            if (profile.twitter) profileTwitter = profile.twitter;
            if (profile.discord) profileDiscord = profile.discord;
            if (profile.comment) profileComment = profile.comment;

            // Add the wallet address if present
            if (profile.address) {
              wallets.push({ address: profile.address });
            }
          }
        });

        if (wallets.length > 0) {
          // Format the holder data to fit ProfileDialog's expected format
          const profile = {
            id: holder.id,
            twitter: profileTwitter,
            discord: profileDiscord,
            comment: profileComment,
            wallets: wallets,
          };

          console.log('Opening social dialog with complete profile:', profile);
          setSelectedHolder(profile);
          setSelectedWalletAddress(holder.address);
          setProfileDialogVisible(true);
          return;
        }
      }

      // Fallback to the original behavior if we couldn't fetch the complete profile
      const profile = {
        id: holder.id, // The backend-generated ID or undefined for new profiles
        twitter: holder.twitter || '',
        discord: holder.discord || '',
        comment: holder.comment || '',
        wallets: holder.address ? [{ address: holder.address }] : [],
      };

      console.log('Opening social dialog with profile:', profile);
      setSelectedHolder(profile);
      setSelectedWalletAddress(holder.address);
      setProfileDialogVisible(true);
    } catch (error) {
      handleError(
        `Error loading profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  // Save social profile for holder
  const handleSaveProfile = async (profile: any) => {
    try {
      const result = await apiSaveSocialProfile(profile);
      if (result.success) {
        setProfileDialogVisible(false);

        // Refresh all components that display holder data
        if (nftHoldersRef.current) {
          nftHoldersRef.current.fetchHolders();
        }

        if (tokenHoldersRef.current) {
          tokenHoldersRef.current.fetchHolders();
        }

        if (socialProfilesRef.current) {
          socialProfilesRef.current.loadSocialProfiles();
        }

        handleSuccess('Social profile saved successfully');
      } else {
        throw new Error(result.message || 'Failed to save profile');
      }
    } catch (error) {
      handleError(
        `Error saving profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  // Delete social profile
  const handleDeleteProfile = async (profileId: string) => {
    try {
      const result = await apiDeleteSocialProfile(profileId);
      if (result.success) {
        setProfileDialogVisible(false);

        // Refresh all components that display holder data
        if (nftHoldersRef.current) {
          nftHoldersRef.current.fetchHolders();
        }

        if (tokenHoldersRef.current) {
          tokenHoldersRef.current.fetchHolders();
        }

        if (socialProfilesRef.current) {
          socialProfilesRef.current.fetchProfiles();
        }

        handleSuccess('Social profile deleted successfully');
      } else {
        throw new Error(result.message || 'Failed to delete profile');
      }
    } catch (error) {
      handleError(
        `Error deleting profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  const handleSuccess = (message: string) => {
    toast.current?.show({
      severity: 'success',
      summary: 'Success',
      detail: message,
      life: 3000,
    });
  };

  const handleError = (message: string) => {
    toast.current?.show({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000,
    });
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="flex align-items-center">
          <h1>Taiyo jeet tracking</h1>
        </div>
        <div className="header-actions">
          <Button
            icon={isDarkMode ? 'pi pi-sun' : 'pi pi-moon'}
            className="p-button-rounded p-button-text"
            onClick={handleThemeToggle}
            tooltip={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          />
        </div>
      </header>

      <main>
        <Toast ref={toast} />
        <ConfirmDialog />

        <TabView activeIndex={activeTab} onTabChange={handleTabChange} className="tab-view">
          <TabPanel header="NFT Holders">
            <NftHolders
              ref={nftHoldersRef}
              onError={handleError}
              onSuccess={handleSuccess}
              onShowSocialDialog={showSocialDialog}
            />
          </TabPanel>

          <TabPanel header="Token Holders">
            <TokenHolders
              ref={tokenHoldersRef}
              onError={handleError}
              onSuccess={handleSuccess}
              onShowSocialDialog={showSocialDialog}
            />
          </TabPanel>

          <TabPanel header="Events">
            <EventsPanel />
          </TabPanel>

          <TabPanel header="Events Timeline">
            <CombinedSnapshotsPanel />
          </TabPanel>

          <TabPanel header="Staking">
            <StakingView onError={handleError} onSuccess={handleSuccess} />
          </TabPanel>

          {/* <TabPanel header="Liquidity Pools">
            <LiquidityPoolsView onError={handleError} onSuccess={handleSuccess} />
          </TabPanel> */}

          <TabPanel header="Social Profiles">
            <SocialProfiles
              ref={socialProfilesRef}
              onError={handleError}
              onSuccess={handleSuccess}
            />
          </TabPanel>
        </TabView>

        <ProfileDialog
          visible={profileDialogVisible}
          onHide={() => setProfileDialogVisible(false)}
          onSave={handleSaveProfile}
          onDelete={handleDeleteProfile}
          profile={selectedHolder}
          selectedWalletAddress={selectedWalletAddress}
        />
      </main>
    </div>
  );
};

// Main App component that provides the Router context
const App: React.FC = () => {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};

export default App;
