import React, { useEffect, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { InputText } from 'primereact/inputtext';
import { Dialog } from 'primereact/dialog';
import { TabView, TabPanel } from 'primereact/tabview';
import { NFTHolder, TokenHolder } from '../types/index.js';
import './App.css';

const App: React.FC = () => {
  const [holders, setHolders] = useState<NFTHolder[]>([]);
  const [tokenHolders, setTokenHolders] = useState<TokenHolder[]>([]);
  const [socialHolders, setSocialHolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState<any>(null);
  const [socialDialogVisible, setSocialDialogVisible] = useState(false);
  const [selectedHolder, setSelectedHolder] = useState<any>(null);
  const [twitterHandle, setTwitterHandle] = useState('');
  const [discordHandle, setDiscordHandle] = useState('');
  const [comment, setComment] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const toast = React.useRef<Toast>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-preference');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    }

    loadThemeCSS(savedTheme === 'light' ? false : true);
  }, []);

  const loadThemeCSS = (dark: boolean) => {
    const themeLink = document.getElementById('app-theme') as HTMLLinkElement;
    
    if (themeLink) {
      themeLink.href = `https://cdn.jsdelivr.net/npm/primereact@9/resources/themes/lara-${dark ? 'dark' : 'light'}-indigo/theme.css`;
    } else {
      const link = document.createElement('link');
      link.id = 'app-theme';
      link.rel = 'stylesheet';
      link.href = `https://cdn.jsdelivr.net/npm/primereact@9/resources/themes/lara-${dark ? 'dark' : 'light'}-indigo/theme.css`;
      document.head.appendChild(link);
    }

    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.body.style.backgroundColor = dark ? '#121212' : '#f5f5f5';
    document.body.style.color = dark ? '#e0e0e0' : '#212121';
  };

  const toggleTheme = () => {
    const newThemeValue = !isDarkMode;
    setIsDarkMode(newThemeValue);
    localStorage.setItem('theme-preference', newThemeValue ? 'dark' : 'light');
    loadThemeCSS(newThemeValue);
  };

  const getApiUrl = () => {
    // In production, API endpoints are on the same domain, so use relative URLs
    if (process.env.NODE_ENV === 'production' || window.location.hostname !== 'localhost') {
      return '/api';
    }
    // In development, use the local dev server
    return process.env.VITE_API_URL || 'http://localhost:3001/api';
  };

  const fetchHolders = async () => {
    try {
      setLoading(true);
      const url = new URL(`${getApiUrl()}/holders`);
      if (searchTerm) {
        url.searchParams.append('search', searchTerm);
      }
      console.log('Fetching holders from:', url.toString());
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to fetch holders: ${response.status} ${response.statusText} ${errorData.message || ''}`);
      }
      
      const data = await response.json();
      setHolders(data);
    } catch (error: any) {
      console.error('Error fetching holders:', error);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: `Failed to fetch holders: ${error.message || 'Unknown error'}`,
        life: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTokenHolders = async () => {
    try {
      setLoading(true);
      const url = new URL(`${getApiUrl()}/token-holders`);
      if (searchTerm) {
        url.searchParams.append('search', searchTerm);
      }
      console.log('Fetching token holders from:', url.toString());
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to fetch token holders: ${response.status} ${response.statusText} ${errorData.message || ''}`);
      }
      
      const data = await response.json();
      setTokenHolders(data);
    } catch (error: any) {
      console.error('Error fetching token holders:', error);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: `Failed to fetch token holders: ${error.message || 'Unknown error'}`,
        life: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSocialProfiles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${getApiUrl()}/social-profiles`);
      if (!response.ok) throw new Error('Failed to fetch social profiles');
      const data = await response.json();
      setSocialHolders(data);
    } catch (error) {
      console.error('Error fetching social profiles:', error);
      toast.current?.show({
        severity: 'error',
        summary: 'Error', 
        detail: 'Failed to fetch social profiles',
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const takeSnapshot = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${getApiUrl()}/snapshot`);
      if (!response.ok) throw new Error('Failed to take snapshot');
      const data = await response.json();
      setHolders(data.holders);
      toast.current?.show({
        severity: 'success',
        summary: 'Success',
        detail: 'NFT snapshot taken successfully',
        life: 3000
      });
    } catch (error) {
      console.error('Error taking snapshot:', error);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to take snapshot',
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const takeTokenSnapshot = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${getApiUrl()}/token-snapshot`);
      if (!response.ok) throw new Error('Failed to take token snapshot');
      const data = await response.json();
      setTokenHolders(data.holders);
      toast.current?.show({
        severity: 'success',
        summary: 'Success',
        detail: 'Token snapshot taken successfully',
        life: 3000
      });
    } catch (error) {
      console.error('Error taking token snapshot:', error);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to take token snapshot',
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSocialProfile = async () => {
    if (!selectedHolder) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${getApiUrl()}/social-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: selectedHolder.address,
          twitter: twitterHandle || undefined,
          discord: discordHandle || undefined,
          comment: comment || undefined,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to save social profile');
      
      const data = await response.json();
      if (data.success) {
        if (activeTab === 0) {
          await fetchHolders();
        } else if (activeTab === 1) {
          await fetchTokenHolders();
        } else if (activeTab === 2) {
          await fetchSocialProfiles();
        }
        
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Social profile saved successfully',
          life: 3000
        });
        
        setSocialDialogVisible(false);
      }
    } catch (error) {
      console.error('Error saving social profile:', error);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to save social profile',
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 0) {
      fetchHolders();
    } else if (activeTab === 1) {
      fetchTokenHolders();
    } else if (activeTab === 2) {
      fetchSocialProfiles();
    }
  }, [activeTab, searchTerm]);

  const addressTemplate = (rowData: any) => (
    <a
      href={`https://solscan.io/account/${rowData.address}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      {rowData.address}
    </a>
  );

  const rowExpansionTemplate = (holder: NFTHolder) => (
    <DataTable value={holder.nfts} responsiveLayout="scroll" className="p-datatable-sm">
      <Column field="mint" header="Mint" />
      <Column field="name" header="Name" />
      <Column field="type" header="Collection" />
    </DataTable>
  );

  const socialActionsTemplate = (rowData: any) => (
    <Button
      icon="pi pi-user-edit"
      className="p-button-rounded p-button-info p-button-sm"
      onClick={() => {
        setSelectedHolder(rowData);
        setTwitterHandle(rowData.socialProfiles?.twitter || '');
        setDiscordHandle(rowData.socialProfiles?.discord || '');
        setComment(rowData.socialProfiles?.comment || '');
        setSocialDialogVisible(true);
      }}
      tooltip="Add/Edit Social Info"
      tooltipOptions={{ position: 'top', showDelay: 50 }}
    />
  );

  const twitterTemplate = (rowData: any) => {
    if (!rowData.socialProfiles?.twitter) return 'N/A';
    return (
      <a 
        href={`https://twitter.com/${rowData.socialProfiles.twitter}`} 
        target="_blank" 
        rel="noopener noreferrer"
        className="social-link twitter"
      >
        @{rowData.socialProfiles.twitter}
      </a>
    );
  };

  const discordTemplate = (rowData: any) => {
    return rowData.socialProfiles?.discord || 'N/A';
  };

  const tokenBalanceTemplate = (rowData: any) => {
    return rowData.balance ? rowData.balance.toLocaleString() : 'N/A';
  };

  const formatTokenBalance = (value: number) => {
    return value.toLocaleString();
  };

  const socialInfoTemplate = (rowData: any) => {
    if (rowData.socialProfiles?.twitter) {
      return (
        <a 
          href={`https://twitter.com/${rowData.socialProfiles.twitter}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="social-link twitter"
        >
          @{rowData.socialProfiles.twitter}
        </a>
      );
    } else if (rowData.socialProfiles?.comment) {
      return <span title={rowData.socialProfiles.comment}>{rowData.socialProfiles.comment}</span>;
    }
    return 'N/A';
  };

  const getRowClassName = (rowData: any) => {
    return (rowData.socialProfiles?.twitter || 
           rowData.socialProfiles?.discord || 
           rowData.socialProfiles?.comment) 
           ? 'has-social-profile' 
           : '';
  };

  return (
    <div className={`${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
      <style>
        {`
          .p-datatable-tbody > tr.has-social-profile {
            background-color: ${isDarkMode ? 'rgba(25, 118, 210, 0.25)' : 'rgba(227, 242, 253, 0.9)'} !important;
          }
          .p-datatable-tbody > tr.has-social-profile > td {
            background-color: transparent !important;
          }
        `}
      </style>
      <div className="theme-switcher">
        <Button
          icon={isDarkMode ? 'pi pi-sun' : 'pi pi-moon'}
          onClick={toggleTheme}
          className="p-button-rounded p-button-text"
          tooltip={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          tooltipOptions={{ position: 'bottom' }}
          aria-label="Toggle Theme"
        />
      </div>
      
      <Toast ref={toast} />
      
      <TabView activeIndex={activeTab} onTabChange={(e) => setActiveTab(e.index)}>
        <TabPanel header="NFT Holders">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">NFT Collection Holders</h1>
            <div className="flex gap-4 items-center">
              <span className="p-input-icon-left search-input-wrapper">
                <i className="pi pi-search" />
                <InputText
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by address..."
                  className="p-inputtext-sm"
                  style={{ width: '250px' }}
                />
              </span>
              <Button
                label="Take Snapshot"
                icon="pi pi-camera"
                onClick={takeSnapshot}
                loading={loading}
                className="ml-2"
              />
            </div>
          </div>
          <DataTable
            value={holders}
            loading={loading}
            paginator
            rows={10}
            expandedRows={expandedRows}
            onRowToggle={e => setExpandedRows(e.data)}
            rowExpansionTemplate={rowExpansionTemplate}
            dataKey="address"
            className="p-datatable-sm"
            sortField="gen1Count"
            sortOrder={-1}
            removableSort={false}
            rowClassName={getRowClassName}
          >
            <Column expander style={{ width: '3em' }} />
            <Column
              field="address"
              header="Address"
              body={addressTemplate}
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
              header="Social Info"
              body={socialInfoTemplate}
              style={{ minWidth: '200px' }}
              sortable={false}
            />
            <Column
              body={socialActionsTemplate}
              style={{ width: '5em' }}
              header="Actions"
            />
          </DataTable>
        </TabPanel>
        
        <TabPanel header="Token Holders">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Token Holders</h1>
            <div className="flex gap-4 items-center">
              <span className="p-input-icon-left search-input-wrapper">
                <i className="pi pi-search" />
                <InputText
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by address..."
                  className="p-inputtext-sm"
                  style={{ width: '250px' }}
                />
              </span>
              <Button
                label="Take Token Snapshot"
                icon="pi pi-camera"
                onClick={takeTokenSnapshot}
                loading={loading}
                className="ml-2"
              />
            </div>
          </div>
          <DataTable
            value={tokenHolders}
            loading={loading}
            paginator
            rows={10}
            dataKey="address"
            className="p-datatable-sm"
            rowClassName={getRowClassName}
            sortField="balance"
            sortOrder={-1}
            removableSort={false}
          >
            <Column
              field="address"
              header="Address"
              body={addressTemplate}
              sortable
            />
            <Column
              field="balance"
              header="Token Balance"
              body={tokenBalanceTemplate}
              sortable
            />
            <Column
              header="Social Info"
              body={socialInfoTemplate}
              style={{ minWidth: '200px' }}
              sortable={false}
            />
            <Column
              body={socialActionsTemplate}
              style={{ width: '5em' }}
              header="Actions"
            />
          </DataTable>
        </TabPanel>
        
        <TabPanel header="Social Profiles">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Social Profiles</h1>
          </div>
          <DataTable
            value={socialHolders}
            loading={loading}
            paginator
            rows={10}
            dataKey="address"
            className="p-datatable-sm"
            rowClassName={getRowClassName}
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
        </TabPanel>
      </TabView>
      
      <Dialog
        header="Edit Social Profiles"
        visible={socialDialogVisible}
        style={{ width: '450px' }}
        onHide={() => setSocialDialogVisible(false)}
        footer={
          <>
            <Button label="Cancel" icon="pi pi-times" onClick={() => setSocialDialogVisible(false)} className="p-button-text" />
            <Button label="Save" icon="pi pi-check" onClick={saveSocialProfile} loading={loading} />
          </>
        }
      >
        <div className="p-fluid">
          <div className="field">
            <label htmlFor="twitter">Twitter Handle</label>
            <div className="p-inputgroup">
              <span className="p-inputgroup-addon">@</span>
              <InputText
                id="twitter"
                value={twitterHandle}
                onChange={(e) => setTwitterHandle(e.target.value)}
                placeholder="username"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="discord">Discord Handle</label>
            <InputText
              id="discord"
              value={discordHandle}
              onChange={(e) => setDiscordHandle(e.target.value)}
              placeholder="username#1234"
            />
          </div>
          <div className="field">
            <label htmlFor="comment">Comment</label>
            <InputText
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add notes about this holder..."
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default App; 