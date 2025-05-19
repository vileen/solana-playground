import React, { useState, useRef, useEffect } from 'react';
import { TabView, TabPanel } from 'primereact/tabview';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';

import NftHolders from './components/NftHolders.js';
import TokenHolders from './components/TokenHolders.js';
import SocialProfileDialog from './components/SocialProfileDialog.js';
import SocialProfiles from './components/SocialProfiles.js';
import { getSavedTheme, toggleTheme, loadThemeCSS } from './utils/theme.js';
import './App.css';
import './TabViewFix.css';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [socialDialogVisible, setSocialDialogVisible] = useState(false);
  const [selectedHolder, setSelectedHolder] = useState<any>(null);
  
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
    setSelectedHolder(holder);
    setSocialDialogVisible(true);
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
          />
        </TabPanel>
        
        <TabPanel header="Token Holders">
          <TokenHolders 
            onError={handleError}
            onSuccess={handleSuccess}
            onShowSocialDialog={showSocialDialog}
          />
        </TabPanel>
        
        <TabPanel header="Social Profiles">
          <SocialProfiles
            onError={handleError}
            onSuccess={handleSuccess}
            onShowSocialDialog={showSocialDialog}
          />
        </TabPanel>
      </TabView>
      
      <SocialProfileDialog 
        visible={socialDialogVisible}
        onHide={() => setSocialDialogVisible(false)}
        selectedHolder={selectedHolder}
        onSuccess={handleSuccess}
        onError={handleError}
      />
    </div>
  );
};

export default App; 