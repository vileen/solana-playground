import React, { useEffect, useState } from 'react';
import { Card } from 'primereact/card';
import { Chart } from 'primereact/chart';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import ChartDataLabels from 'chartjs-plugin-datalabels';

import { fetchTokenInfo, fetchLostWallets, fetchSocialProfiles } from '../services/api.js';

interface TokenInfoData {
  totalSupply: number;
  lostTokens: number;
  lostStaked: number;
  excludedTokens: number;
  excludedStaked: number;
  realCirculating: number;
  realMcap: number;
}

interface LostWallet {
  id: number;
  wallet_address: string;
  social_id: string | null;
  reason: string | null;
  lost_amount: number | null;
  lost_at: string;
  is_lost: boolean;
  twitter?: string | null;
  discord?: string | null;
  comment?: string | null;
}

interface SocialProfile {
  id: string;
  twitter?: string;
  discord?: string;
  comment?: string;
  wallets?: Array<{ address: string }>;
  displayName?: string;
}

const TokenInfo: React.FC = () => {
  const [tokenInfo, setTokenInfo] = useState<TokenInfoData | null>(null);
  const [lostWallets, setLostWallets] = useState<LostWallet[]>([]);
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<SocialProfile[]>([]);
  const [profileFilter, setProfileFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any>(null);
  const [chartOptions, setChartOptions] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (tokenInfo) {
      updateChart();
    }
  }, [tokenInfo, selectedProfiles]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [info, wallets, profiles] = await Promise.all([
        fetchTokenInfo(),
        fetchLostWallets(),
        fetchSocialProfiles(),
      ]);
      setTokenInfo(info);
      setLostWallets(wallets);
      // Deduplicate profiles by social_id (API returns one entry per wallet)
      const seenIds = new Set<string>();
      const uniqueProfiles: SocialProfile[] = [];
      
      for (const p of profiles) {
        const profileId = p.id || p.social_id;
        if (profileId && !seenIds.has(profileId)) {
          seenIds.add(profileId);
          uniqueProfiles.push({
            ...p,
            displayName: p.twitter || p.discord || p.comment || profileId.slice(0, 8),
          });
        }
      }
      
      setSocialProfiles(uniqueProfiles);
    } catch (error) {
      console.error('Error loading token info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = async (profiles: SocialProfile[]) => {
    setSelectedProfiles(profiles);
    const excludeIds = profiles.map(p => p.id);
    try {
      const info = await fetchTokenInfo(excludeIds);
      setTokenInfo(info);
    } catch (error) {
      console.error('Error fetching token info with exclusions:', error);
    }
  };

  const updateChart = () => {
    if (!tokenInfo) return;

    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--text-color') || '#495057';

    const data = {
      labels: ['Real Circulating', 'Lost Tokens', 'Excluded Profiles'],
      datasets: [
        {
          data: [
            tokenInfo.realCirculating,
            tokenInfo.lostTokens,
            tokenInfo.excludedTokens,
          ],
          backgroundColor: [
            'rgba(34, 197, 94, 0.8)',     // green
            'rgba(239, 68, 68, 0.8)',     // red
            'rgba(245, 158, 11, 0.8)',    // amber
          ],
          borderColor: [
            'rgb(34, 197, 94)',
            'rgb(239, 68, 68)',
            'rgb(245, 158, 11)',
          ],
          borderWidth: 2,
        },
      ],
    };

    const options = {
      maintainAspectRatio: false,
      aspectRatio: 1,
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: {
            color: textColor,
            usePointStyle: true,
            padding: 20,
          },
        },
        tooltip: {
          callbacks: {
            label: function(context: any) {
              const label = context.label || '';
              const value = context.parsed;
              const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(2);
              return `${label}: ${new Intl.NumberFormat('en-US', {
                notation: 'compact',
                compactDisplay: 'short',
              }).format(value)} (${percentage}%)`;
            },
          },
        },
        datalabels: {
          color: '#fff',
          font: {
            weight: 'bold' as const,
            size: 12,
          },
          formatter: (value: number, ctx: any) => {
            return new Intl.NumberFormat('en-US', {
              notation: 'compact',
              compactDisplay: 'short',
              maximumFractionDigits: 1,
            }).format(value);
          },
        },
      },
    };

    setChartData(data);
    setChartOptions(options);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatFullNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(num);
  };

  if (loading) {
    return (
      <div className="flex justify-content-center align-items-center h-20rem">
        <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }}></i>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="grid">
        {/* Summary Cards */}
        <div className="col-12 md:col-3">
          <Card className="mb-3">
            <div className="text-center">
              <div className="text-sm text-color-secondary mb-2">Total Supply (FDV)</div>
              <div className="text-2xl font-bold text-blue-500">
                {formatNumber(tokenInfo?.totalSupply || 0)}
              </div>
              <div className="text-xs text-color-secondary mt-1">
                {formatFullNumber(tokenInfo?.totalSupply || 0)} $GP
              </div>
            </div>
          </Card>
        </div>

        <div className="col-12 md:col-3">
          <Card className="mb-3">
            <div className="text-center">
              <div className="text-sm text-color-secondary mb-2">Lost Tokens</div>
              <div className="text-2xl font-bold text-red-500">
                {formatNumber(tokenInfo?.lostTokens || 0)}
              </div>
              <div className="text-xs text-color-secondary mt-1">
                {formatFullNumber(tokenInfo?.lostTokens || 0)} $GP
              </div>
            </div>
          </Card>
        </div>

        <div className="col-12 md:col-3">
          <Card className="mb-3">
            <div className="text-center">
              <div className="text-sm text-color-secondary mb-2">Excluded Profiles</div>
              <div className="text-2xl font-bold text-amber-500">
                {formatNumber(tokenInfo?.excludedTokens || 0)}
              </div>
              <div className="text-xs text-color-secondary mt-1">
                {formatFullNumber(tokenInfo?.excludedTokens || 0)} $GP
              </div>
            </div>
          </Card>
        </div>

        <div className="col-12 md:col-3">
          <Card className="mb-3">
            <div className="text-center">
              <div className="text-sm text-color-secondary mb-2">Real Circulating</div>
              <div className="text-2xl font-bold text-green-500">
                {formatNumber(tokenInfo?.realCirculating || 0)}
              </div>
              <div className="text-xs text-color-secondary mt-1">
                {formatFullNumber(tokenInfo?.realCirculating || 0)} $GP
              </div>
            </div>
          </Card>
        </div>

        {/* Chart */}
        <div className="col-12 lg:col-6">
          <Card title="Token Supply Breakdown" className="mb-3">
            <div style={{ height: '350px' }}>
              {chartData && (
                <Chart 
                  type="pie" 
                  data={chartData} 
                  options={chartOptions}
                  plugins={[ChartDataLabels]}
                />
              )}
            </div>
          </Card>
        </div>

        {/* Profile Exclusion */}
        <div className="col-12 lg:col-4">
          <Card title="Exclude Profiles from Calculation" className="mb-3">
            <div className="mb-3">
              <label className="block text-sm font-medium mb-2">
                Select profiles to exclude (e.g. team wallets, treasury)
              </label>
              <div className="mb-2">
                <input
                  type="text"
                  value={profileFilter}
                  onChange={(e) => setProfileFilter(e.target.value)}
                  placeholder="Search profiles..."
                  className="w-full p-2 border-1 border-round"
                  style={{ borderColor: 'var(--surface-border)' }}
                />
              </div>
              <div className="flex flex-column gap-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {socialProfiles
                  .filter(p => {
                    if (!profileFilter) return true;
                    const search = profileFilter.toLowerCase();
                    return (
                      (p.displayName && p.displayName.toLowerCase().includes(search)) ||
                      (p.twitter && p.twitter.toLowerCase().includes(search)) ||
                      (p.discord && p.discord.toLowerCase().includes(search)) ||
                      (p.comment && p.comment.toLowerCase().includes(search))
                    );
                  })
                  .map((profile) => (
                    <div key={profile.id} className="flex align-items-center">
                      <input
                        type="checkbox"
                        id={`profile-${profile.id}`}
                        checked={selectedProfiles.some(p => p.id === profile.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleProfileChange([...selectedProfiles, profile]);
                          } else {
                            handleProfileChange(selectedProfiles.filter(p => p.id !== profile.id));
                          }
                        }}
                        className="mr-2"
                      />
                      <label htmlFor={`profile-${profile.id}`} className="text-sm cursor-pointer">
                        <span className="font-bold">{profile.displayName}</span>
                        {profile.twitter && profile.displayName !== profile.twitter && (
                          <span className="text-color-secondary ml-1">({profile.twitter})</span>
                        )}
                      </label>
                    </div>
                  ))}
              </div>
            </div>
            {selectedProfiles.length > 0 && (
              <div className="text-sm text-color-secondary">
                Excluding {selectedProfiles.length} profile(s)
                <Button
                  label="Clear"
                  icon="pi pi-times"
                  className="p-button-text p-button-sm ml-2"
                  onClick={() => handleProfileChange([])}
                />
              </div>
            )}
          </Card>

          {/* Lost Staked Info */}
          <Card title="Lost Staked Tokens" className="mb-3">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-500">
                {formatNumber(tokenInfo?.lostStaked || 0)}
              </div>
              <div className="text-sm text-color-secondary mt-1">
                {formatFullNumber(tokenInfo?.lostStaked || 0)} $GP in lost staking positions
              </div>
            </div>
          </Card>
        </div>

        {/* Lost Wallets Table */}
        <div className="col-12">
          <Card title="Lost Wallets">
            <DataTable
              value={lostWallets}
              paginator
              rows={10}
              emptyMessage="No lost wallets"
            >
              <Column
                field="wallet_address"
                header="Wallet Address"
                body={(row: LostWallet) => (
                  <span className="font-mono text-sm">{row.wallet_address}</span>
                )}
              />
              <Column
                field="twitter"
                header="Twitter"
                body={(row: LostWallet) => row.twitter || '-'}
              />
              <Column
                field="discord"
                header="Discord"
                body={(row: LostWallet) => row.discord || '-'}
              />
              <Column
                field="reason"
                header="Reason"
                body={(row: LostWallet) => row.reason || '-'}
              />
              <Column
                field="lost_amount"
                header="Lost Amount"
                body={(row: LostWallet) =>
                  row.lost_amount ? formatNumber(row.lost_amount) : 'Unknown'
                }
              />
              <Column
                field="lost_at"
                header="Date Marked Lost"
                body={(row: LostWallet) => new Date(row.lost_at).toLocaleDateString()}
              />
              <Column
                header="Status"
                body={() => <Tag severity="danger" value="LOST" />}
              />
            </DataTable>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TokenInfo;
