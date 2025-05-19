import React, { useState, useRef, useEffect } from 'react';
import { TabView, TabPanel } from 'primereact/tabview';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';
import { ConfirmDialog } from 'primereact/confirmdialog';

import NftHolders from './components/NftHolders.js';
import TokenHolders from './components/TokenHolders.js';
import ProfileDialog from './components/ProfileDialog.js';
import SocialProfiles from './components/SocialProfiles.js';
import { getSavedTheme, toggleTheme, loadThemeCSS } from './utils/theme.js';
import './App.css';
import './TabViewFix.css';
import { saveSocialProfile as apiSaveSocialProfile, deleteSocialProfile as apiDeleteSocialProfile, fetchNftHolders, fetchTokenHolders } from './services/api.js';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [profileDialogVisible, setProfileDialogVisible] = useState(false);
  const [selectedHolder, setSelectedHolder] = useState<any>(null);
  const [sharedSearchTerm, setSharedSearchTerm] = useState('');
  
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

  const handleThemeToggle = () => {
    setIsDarkMode(toggleTheme(isDarkMode));
  };

  const showSocialDialog = (holder: any) => {
    // Format the holder data to fit ProfileDialog's expected format
    const profile = {
      id: holder.id, // The backend-generated ID or undefined for new profiles
      twitter: holder.twitter || '',
      discord: holder.discord || '',
      comment: holder.comment || '',
      wallets: holder.address ? [{ address: holder.address }] : []
    };
    
    console.log('Opening social dialog with profile:', profile);
    setSelectedHolder(profile);
    setProfileDialogVisible(true);
  };

  // Force refresh all data
  const refreshAllData = () => {
    // Trigger refresh in all components
    if (nftHoldersRef.current && nftHoldersRef.current.fetchHolders) {
      nftHoldersRef.current.fetchHolders();
    }
    
    if (tokenHoldersRef.current && tokenHoldersRef.current.fetchHolders) {
      tokenHoldersRef.current.fetchHolders();
    }
    
    if (socialProfilesRef.current && socialProfilesRef.current.loadSocialProfiles) {
      socialProfilesRef.current.loadSocialProfiles();
    }
  };

  const handleSaveProfile = async (profileData: any) => {
    try {
      if (!profileData.wallets || profileData.wallets.length === 0) {
        handleError('At least one wallet address is required');
        return;
      }
      
      const result = await apiSaveSocialProfile(profileData);
      setProfileDialogVisible(false);
      
      // Refresh data in all tabs
      refreshAllData();
      
      handleSuccess(profileData.id ? 'Profile updated successfully' : 'New profile created successfully');
    } catch (error: any) {
      handleError(`Failed to save profile: ${error.message}`);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    try {
      // First call the API to delete the profile
      await apiDeleteSocialProfile(profileId);
      
      // Only after successful deletion:
      // 1. Close the profile dialog (if it hasn't been closed already)
      setProfileDialogVisible(false);
      
      // 2. Refresh data in all tabs
      refreshAllData();
      
      // 3. Show success message
      handleSuccess('Profile deleted successfully');
    } catch (error: any) {
      handleError(`Failed to delete profile: ${error.message}`);
    }
  };

  const handleSuccess = (message: string) => {
    toast.current?.show({
      severity: 'success',
      summary: 'Success',
      detail: message,
      life: 3000
    });
  };

  const handleError = (message: string) => {
    toast.current?.show({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000
    });
  };

  return (
    <div className="app-container">
      <Toast ref={toast} />
      <ConfirmDialog />
      
      <header className="app-header">
        <h1>Solana NFT Snapshot Tool</h1>
        <div className="header-actions">
          <Button 
            icon={isDarkMode ? "pi pi-sun" : "pi pi-moon"} 
            className="p-button-rounded p-button-text" 
            onClick={handleThemeToggle} 
            tooltip={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          />
        </div>
      </header>
      
      <TabView 
        activeIndex={activeTab} 
        onTabChange={(e) => setActiveTab(e.index)}
        className="tab-view"
      >
        <TabPanel header="NFT Holders">
          <NftHolders 
            ref={nftHoldersRef}
            onError={handleError}
            onSuccess={handleSuccess}
            onShowSocialDialog={showSocialDialog}
            searchTerm={sharedSearchTerm}
            onSearchChange={setSharedSearchTerm}
          />
        </TabPanel>
        
        <TabPanel header="Token Holders">
          <TokenHolders 
            ref={tokenHoldersRef}
            onError={handleError}
            onSuccess={handleSuccess}
            onShowSocialDialog={showSocialDialog}
            searchTerm={sharedSearchTerm}
            onSearchChange={setSharedSearchTerm}
          />
        </TabPanel>
        
        <TabPanel header="Social Profiles">
          <SocialProfiles
            ref={socialProfilesRef}
            onError={handleError}
            onSuccess={handleSuccess}
            onShowSocialDialog={showSocialDialog}
            searchTerm={sharedSearchTerm}
            onSearchChange={setSharedSearchTerm}
          />
        </TabPanel>
      </TabView>
      
      <ProfileDialog 
        visible={profileDialogVisible}
        onHide={() => setProfileDialogVisible(false)}
        onSave={handleSaveProfile}
        onDelete={handleDeleteProfile}
        profile={selectedHolder}
      />
    </div>
  );
};

export default App; 