import { Card } from 'primereact/card';
import React from 'react';

interface SummaryStatsProps {
  stats: {
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
  };
}

const SummaryStats: React.FC<SummaryStatsProps> = ({ stats }) => {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="grid">
      <div className="col-12 md:col-6">
        <Card title="NFT Collection" className="h-full">
          <div className="flex flex-column gap-3">
            <div className="flex justify-content-between">
              <span className="font-medium">Total NFTs:</span>
              <span>{stats.nft.totalNFTs}</span>
            </div>
            <div className="flex justify-content-between">
              <span className="font-medium">Total Holders:</span>
              <span>{stats.nft.totalHolders}</span>
            </div>
            <div className="flex justify-content-between">
              <span className="font-medium">Last Updated:</span>
              <span>{formatDate(stats.nft.lastUpdated)}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="col-12 md:col-6">
        <Card title="Token" className="h-full">
          <div className="flex flex-column gap-3">
            <div className="flex justify-content-between">
              <span className="font-medium">Total Supply:</span>
              <span>{stats.token.totalSupply}</span>
            </div>
            <div className="flex justify-content-between">
              <span className="font-medium">Total Holders:</span>
              <span>{stats.token.totalHolders}</span>
            </div>
            <div className="flex justify-content-between">
              <span className="font-medium">Last Updated:</span>
              <span>{formatDate(stats.token.lastUpdated)}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SummaryStats; 