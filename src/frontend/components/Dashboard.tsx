import React, { useContext, useEffect, useState } from 'react';

import { Button } from 'primereact/button';
import { Card } from 'primereact/card';

import { NFTHolder, TokenHolder } from '../../types/index.js';
import { AppContext } from '../AppContext.js';
import { fetchSocialProfiles, takeNftSnapshot, takeTokenSnapshot } from '../services/api.js';
import EventsPanel from './EventsPanel.js';
import NFTHoldersTable from './NFTHoldersTable.js';
import SummaryStats from './SummaryStats.js';
import TokenHoldersTable from './TokenHoldersTable.js';

interface Stats {
  nft: {
    totalNFTs: number;
    totalHolders: number;
    lastUpdated: string | null;
  };
  token: {
    totalSupply: number;
    totalHolders: number;
    lastUpdated: string | null;
  };
}

interface DashboardProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onSuccess, onError }) => {
  const context = useContext(AppContext);
  const state = context?.state;
  const dispatch = context?.dispatch;
  
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [tokenSnapshotLoading, setTokenSnapshotLoading] = useState(false);
  const [summaryStats, setSummaryStats] = useState<Stats>({
    nft: {
      totalNFTs: 0,
      totalHolders: 0,
      lastUpdated: null
    },
    token: {
      totalSupply: 0,
      totalHolders: 0,
      lastUpdated: null
    }
  });
  const [nftHolders, setNftHolders] = useState<NFTHolder[]>([]);
  const [tokenHolders, setTokenHolders] = useState<TokenHolder[]>([]);

  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const profiles = await fetchSocialProfiles();
        if (dispatch) {
          dispatch({ type: 'SET_SOCIAL_PROFILES', payload: profiles });
        }
      } catch (error) {
        console.error('Error loading social profiles:', error);
        onError('Failed to load social profiles');
      }
    };

    loadProfiles();
  }, [dispatch, onError]);

  const handleTakeSnapshot = async () => {
    setSnapshotLoading(true);
    try {
      const snapshotData = await takeNftSnapshot();
      console.log('Snapshot taken:', snapshotData);
      // Update summary stats
      setSummaryStats(prev => ({
        ...prev,
        nft: {
          ...prev.nft,
          totalNFTs: snapshotData.total || 0,
          totalHolders: snapshotData.holders?.length || 0,
          lastUpdated: snapshotData.timestamp
        }
      }));
      // Update holders list
      setNftHolders(snapshotData.holders || []);
      // Update app state
      if (dispatch) {
        dispatch({ type: 'SET_LAST_UPDATED_NFT', payload: new Date(snapshotData.timestamp) });
      }
      onSuccess('NFT snapshot taken successfully');
    } catch (error: any) {
      console.error('Error taking snapshot:', error);
      onError(`Failed to take NFT snapshot: ${error.message}`);
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleTakeTokenSnapshot = async () => {
    setTokenSnapshotLoading(true);
    try {
      const snapshotData = await takeTokenSnapshot();
      console.log('Token snapshot taken:', snapshotData);
      // Update summary stats
      setSummaryStats(prev => ({
        ...prev,
        token: {
          ...prev.token,
          totalSupply: snapshotData.totalSupply || 0,
          totalHolders: snapshotData.holders?.length || 0,
          lastUpdated: snapshotData.timestamp
        }
      }));
      // Update holders list
      setTokenHolders(snapshotData.holders || []);
      // Update app state
      if (dispatch) {
        dispatch({ type: 'SET_LAST_UPDATED_TOKEN', payload: new Date(snapshotData.timestamp) });
      }
      onSuccess('Token snapshot taken successfully');
    } catch (error: any) {
      console.error('Error taking token snapshot:', error);
      onError(`Failed to take token snapshot: ${error.message}`);
    } finally {
      setTokenSnapshotLoading(false);
    }
  };

  return (
    <div className="grid">
      <div className="col-12">
        <SummaryStats stats={summaryStats} />
      </div>

      <div className="col-12">
        <Card className="mb-5">
          <div className="flex flex-column md:flex-row gap-3 mb-3">
            <Button
              label="Take NFT Snapshot"
              icon="pi pi-camera"
              onClick={handleTakeSnapshot}
              loading={snapshotLoading}
              className="p-button-raised"
            />
            <Button
              label="Take Token Snapshot"
              icon="pi pi-dollar"
              onClick={handleTakeTokenSnapshot}
              loading={tokenSnapshotLoading}
              className="p-button-raised p-button-success"
            />
          </div>
        </Card>
      </div>

      <div className="col-12">
        <EventsPanel />
      </div>

      <div className="col-12 lg:col-6">
        <Card title="Token Holders" className="mb-5">
          <TokenHoldersTable 
            holders={tokenHolders} 
            loading={tokenSnapshotLoading}
            onShowSocialDialog={() => console.log('Show social dialog')} 
          />
        </Card>
      </div>

      <div className="col-12 lg:col-6">
        <Card title="NFT Holders" className="mb-5">
          <NFTHoldersTable 
            holders={nftHolders} 
            loading={snapshotLoading}
            onShowSocialDialog={() => console.log('Show social dialog')} 
          />
        </Card>
      </div>
    </div>
  );
};

export default Dashboard; 