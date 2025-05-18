import React, { useEffect, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { InputText } from 'primereact/inputtext';
import { Dialog } from 'primereact/dialog';
import { TabView, TabPanel } from 'primereact/tabview';
import { NFTHolder } from '../types';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import './App.css';

const App: React.FC = () => {
  const [holders, setHolders] = useState<NFTHolder[]>([]);
  const [socialHolders, setSocialHolders] = useState<NFTHolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState<any>(null);
  const [socialDialogVisible, setSocialDialogVisible] = useState(false);
  const [selectedHolder, setSelectedHolder] = useState<NFTHolder | null>(null);
  const [twitterHandle, setTwitterHandle] = useState('');
  const [discordHandle, setDiscordHandle] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const toast = React.useRef<Toast>(null);

  const fetchHolders = async () => {
    try {
      setLoading(true);
      const url = new URL('http://localhost:3001/api/holders');
      if (searchTerm) {
        url.searchParams.append('search', searchTerm);
      }
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch holders');
      const data = await response.json();
      setHolders(data);
    } catch (error) {
      console.error('Error fetching holders:', error);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to fetch holders',
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSocialProfiles = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/social-profiles');
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
      const response = await fetch('http://localhost:3001/api/snapshot');
      if (!response.ok) throw new Error('Failed to take snapshot');
      const data = await response.json();
      setHolders(data.holders);
      toast.current?.show({
        severity: 'success',
        summary: 'Success',
        detail: 'Snapshot taken successfully',
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

  const saveSocialProfile = async () => {
    if (!selectedHolder) return;
    
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/social-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: selectedHolder.address,
          twitter: twitterHandle || undefined,
          discord: discordHandle || undefined,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to save social profile');
      
      const data = await response.json();
      if (data.success) {
        // Update the holders list with the updated social profile
        const updatedHolders = holders.map(h => 
          h.address === selectedHolder.address ? 
          {...h, socialProfiles: { twitter: twitterHandle, discord: discordHandle }} : 
          h
        );
        setHolders(updatedHolders);
        
        // Update social holders if we're on that tab
        if (activeTab === 1) {
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
    fetchHolders();
  }, [searchTerm]);

  useEffect(() => {
    if (activeTab === 1) {
      fetchSocialProfiles();
    }
  }, [activeTab]);

  const addressTemplate = (rowData: NFTHolder) => (
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
    </DataTable>
  );

  const socialActionsTemplate = (rowData: NFTHolder) => (
    <Button
      icon="pi pi-user-edit"
      className="p-button-rounded p-button-info p-button-sm"
      onClick={() => {
        setSelectedHolder(rowData);
        setTwitterHandle(rowData.socialProfiles?.twitter || '');
        setDiscordHandle(rowData.socialProfiles?.discord || '');
        setSocialDialogVisible(true);
      }}
      tooltip="Add/Edit Social Info"
    />
  );

  const twitterTemplate = (rowData: NFTHolder) => {
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

  const discordTemplate = (rowData: NFTHolder) => {
    return rowData.socialProfiles?.discord || 'N/A';
  };

  return (
    <div>
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
          >
            <Column expander style={{ width: '3em' }} />
            <Column
              field="address"
              header="Address"
              body={addressTemplate}
              sortable
            />
            <Column
              field="nftCount"
              header="NFT Count"
              sortable
            />
            <Column
              body={socialActionsTemplate}
              style={{ width: '5em' }}
              header="Social"
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
              field="nftCount"
              header="NFT Count"
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
        </div>
      </Dialog>
    </div>
  );
};

export default App; 