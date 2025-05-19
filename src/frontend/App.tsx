import React, { useState, useRef, useEffect } from 'react';
import { TabView, TabPanel } from 'primereact/tabview';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';

import NftHolders from './components/NftHolders.js';
import TokenHolders from './components/TokenHolders.js';
import ProfileDialog from './components/ProfileDialog.js';
import SocialProfiles from './components/SocialProfiles.js';
import { getSavedTheme, toggleTheme, loadThemeCSS } from './utils/theme.js';
import './App.css';
import './TabViewFix.css';
import { saveSocialProfile as apiSaveSocialProfile } from './services/api.js';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [profileDialogVisible, setProfileDialogVisible] = useState(false);
  const [selectedHolder, setSelectedHolder] = useState<any>(null);
  const [sharedSearchTerm, setSharedSearchTerm] = useState('');
  
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
      id: holder.id,
      twitter: holder.twitter || '',
      discord: holder.discord || '',
      comment: holder.comment || '',
      wallets: holder.address ? [{ address: holder.address }] : []
    };
    
    setSelectedHolder(profile);
    setProfileDialogVisible(true);
  };

  const handleSaveProfile = async (profileData: any) => {
    try {
      if (!profileData.wallets || profileData.wallets.length === 0) {
        handleError('At least one wallet address is required');
        return;
      }
      
      const result = await apiSaveSocialProfile(profileData);
      setProfileDialogVisible(false);
      
      // Refresh the current tab
      if (activeTab === 0) {
        // NFT Holders tab
        // Component will handle its own refresh
      } else if (activeTab === 1) {
        // Token Holders tab
        // Component will handle its own refresh
      } else if (activeTab === 2) {
        // Social Profiles tab
        // Component will handle its own refresh
      }
      
      handleSuccess(profileData.id ? 'Profile updated successfully' : 'New profile created successfully');
    } catch (error: any) {
      handleError(`Failed to save profile: ${error.message}`);
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
            onError={handleError}
            onSuccess={handleSuccess}
            onShowSocialDialog={showSocialDialog}
            searchTerm={sharedSearchTerm}
            onSearchChange={setSharedSearchTerm}
          />
        </TabPanel>
        
        <TabPanel header="Token Holders">
          <TokenHolders 
            onError={handleError}
            onSuccess={handleSuccess}
            onShowSocialDialog={showSocialDialog}
            searchTerm={sharedSearchTerm}
            onSearchChange={setSharedSearchTerm}
          />
        </TabPanel>
        
        <TabPanel header="Social Profiles">
          <SocialProfiles
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
        profile={selectedHolder}
      />
    </div>
  );
};

export default App; 