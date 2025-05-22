import { useCallback, useEffect, useState } from 'react';

import { ChartData, ChartOptions } from 'chart.js';
import { Button } from 'primereact/button';
import { Chart } from 'primereact/chart';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { ProgressSpinner } from 'primereact/progressspinner';

import { Stake, StakeData } from '../../types/index.js';

import SearchBar from './SearchBar.js';
import SocialPillComment from './SocialPillComment.js';
import SocialPillDiscord from './SocialPillDiscord.js';
import SocialPillX from './SocialPillX.js';
import {
  fetchSocialProfiles,
  fetchStakingData,
  fetchStakingSnapshots,
  fetchUnlockSummary,
  takeStakingSnapshot,
} from './StakingAPI.js';

interface StakingViewProps {
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

interface SocialInfo {
  twitter?: string | null;
  discord?: string | null;
  comment?: string | null;
  id?: string;
}

const StakingView = ({ onError, onSuccess }: StakingViewProps) => {
  const [stakingData, setStakingData] = useState<StakeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedRows, setExpandedRows] = useState<any>({});
  const [unlockSummary, setUnlockSummary] = useState<{ date: string; amount: number }[]>([]);
  const [unlockSummaryVisible, setUnlockSummaryVisible] = useState(false);
  const [socialProfiles, setSocialProfiles] = useState<Record<string, SocialInfo>>({});
  const [chartKey, setChartKey] = useState<number>(0);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        await fetchSnapshots();
        await fetchSocialProfilesData();
        await fetchStakingDataFromApi();
        await fetchUnlockSummaryData();
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Reload data when snapshot changes
  useEffect(() => {
    const reloadData = async () => {
      try {
        setLoading(true);
        await fetchStakingDataFromApi();
        await fetchUnlockSummaryData();
      } catch (error) {
        console.error('Error reloading data:', error);
      } finally {
        setLoading(false);
      }
    };

    reloadData();
  }, [selectedSnapshotId]);

  const fetchSnapshots = async () => {
    try {
      const data = await fetchStakingSnapshots();
      setSnapshots(data);
    } catch (error: any) {
      console.error('Error fetching snapshots:', error);
      onError(`Failed to fetch snapshots: ${error.message || 'Unknown error'}`);
    }
  };

  const fetchSocialProfilesData = async () => {
    try {
      const profiles = await fetchSocialProfiles();

      // Convert array to map for easy lookup
      const profileMap: Record<string, SocialInfo> = {};

      profiles.forEach((profile: any) => {
        profileMap[profile.address] = {
          twitter: profile.twitter,
          discord: profile.discord,
          comment: profile.comment,
          id: profile.id,
        };
      });

      setSocialProfiles(profileMap);
    } catch (error: any) {
      console.error('Error fetching social profiles:', error);
      onError(`Failed to fetch social profiles: ${error.message || 'Unknown error'}`);
    }
  };

  const fetchStakingDataFromApi = async () => {
    try {
      setLoading(true);
      const snapshotIdParam = selectedSnapshotId === null ? undefined : selectedSnapshotId;
      const data = await fetchStakingData(searchTerm, snapshotIdParam);
      setStakingData(data);
    } catch (error: any) {
      console.error('Error fetching staking data:', error);
      onError(`Failed to fetch staking data: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnlockSummaryData = async () => {
    try {
      const snapshotIdParam = selectedSnapshotId === null ? undefined : selectedSnapshotId;
      const summary = await fetchUnlockSummary(snapshotIdParam);
      setUnlockSummary(summary);
    } catch (error: any) {
      console.error('Error fetching unlock summary:', error);
      onError(`Failed to fetch unlock summary: ${error.message || 'Unknown error'}`);
    }
  };

  const handleSearch = async (value: string) => {
    setSearchTerm(value);
    try {
      const snapshotIdParam = selectedSnapshotId === null ? undefined : selectedSnapshotId;
      const data = await fetchStakingData(value, snapshotIdParam);
      setStakingData(data);
    } catch (error: any) {
      console.error('Error searching staking data:', error);
      onError(`Failed to search staking data: ${error.message || 'Unknown error'}`);
    }
  };

  const takeSnapshot = async () => {
    try {
      setLoading(true);
      await takeStakingSnapshot();
      await fetchSnapshots();
      await fetchStakingDataFromApi();
      await fetchUnlockSummaryData();
      onSuccess('Staking snapshot taken successfully');
    } catch (error: any) {
      console.error('Error taking staking snapshot:', error);
      onError(`Failed to take staking snapshot: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Format token amount
  const formatTokenAmount = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Social profile template
  const socialProfileTemplate = (rowData: StakeData) => {
    const profile = socialProfiles[rowData.walletAddress];

    if (!profile) {
      return <span className="text-muted">-</span>;
    }

    return (
      <div className="flex flex-wrap gap-1">
        {profile.comment && <SocialPillComment text={profile.comment} />}
        {profile.twitter && <SocialPillX handle={profile.twitter} />}
        {profile.discord && <SocialPillDiscord handle={profile.discord} />}
      </div>
    );
  };

  // Address template
  const addressTemplate = (rowData: StakeData) => (
    <div className="flex align-items-center">
      <span className="font-medium">{rowData.walletAddress}</span>
    </div>
  );

  // Token balance template
  const tokenBalanceTemplate = (rowData: StakeData, field: string) => (
    <div className="text-right font-medium">
      {formatTokenAmount(rowData[field as keyof StakeData] as number)}
    </div>
  );

  // Row expander template
  const rowExpansionTemplate = (data: StakeData) => {
    return (
      <div className="p-3">
        <h5 className="mb-2">Staking Details for {data.walletAddress}</h5>
        <DataTable value={data.stakes} className="p-datatable-sm">
          <Column
            field="amount"
            header="Amount"
            body={(rowData: Stake) => (
              <div className="text-right">{formatTokenAmount(rowData.amount)}</div>
            )}
          />
          <Column
            field="stakeDate"
            header="Stake Date"
            body={(rowData: Stake) => <div>{formatDate(rowData.stakeDate)}</div>}
          />
          <Column
            field="unlockDate"
            header="Unlock Date"
            body={(rowData: Stake) => <div>{formatDate(rowData.unlockDate)}</div>}
          />
          <Column
            field="isLocked"
            header="Status"
            body={(rowData: Stake) => (
              <div>
                <span
                  className={`p-badge p-component ${rowData.isLocked ? 'p-badge-warning' : 'p-badge-success'}`}
                >
                  {rowData.isLocked ? 'Locked' : 'Unlocked'}
                </span>
              </div>
            )}
          />
        </DataTable>
      </div>
    );
  };

  // Snapshot selector
  const snapshotSelector = () => {
    if (snapshots.length === 0) return null;

    const options = snapshots.map(snapshot => ({
      label: `${new Date(snapshot.timestamp).toLocaleString()} (ID: ${snapshot.id})`,
      value: snapshot.id,
    }));

    // Add an option for the latest snapshot
    options.unshift({
      label: 'Latest Snapshot',
      value: null,
    });

    return (
      <div className="flex align-items-center mr-3">
        <span className="font-medium mr-2">Snapshot:</span>
        <Dropdown
          value={selectedSnapshotId}
          options={options}
          onChange={e => {
            setSelectedSnapshotId(e.value);
          }}
          placeholder="Latest Snapshot"
        />
      </div>
    );
  };

  // Footer template with action buttons
  const footerTemplate = () => (
    <div className="flex justify-content-between align-items-center">
      <div className="flex align-items-center">
        {snapshotSelector()}
        <Button
          label="Take Snapshot"
          icon="pi pi-camera"
          className="p-button-success mr-2"
          onClick={takeSnapshot}
          disabled={loading}
        />
        <Button
          label="Future Unlocks Chart"
          icon="pi pi-calendar"
          className="p-button-info"
          onClick={() => setUnlockSummaryVisible(true)}
          disabled={loading}
        />
      </div>
      <div>
        <span className="font-medium mr-2">{stakingData.length} wallet(s) found</span>
      </div>
    </div>
  );

  // Memoize chart data preparation to avoid unnecessary rerenders
  const prepareChartData = useCallback((): ChartData => {
    // Make sure we have data, even if empty
    if (!unlockSummary || unlockSummary.length === 0) {
      return {
        labels: ['No unlock data available'],
        datasets: [
          {
            label: 'Tokens Unlocking',
            data: [0],
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
            borderColor: 'rgb(75, 192, 192)',
            borderWidth: 1,
          },
        ],
      };
    }

    const labels = unlockSummary.map(item => formatDate(item.date));
    const data = unlockSummary.map(item => item.amount);

    // Create color gradient for the bars (blue to teal)
    const gradientColors = [
      'rgba(54, 162, 235, 0.7)', // blue
      'rgba(75, 192, 192, 0.7)', // teal
      'rgba(20, 184, 166, 0.7)', // teal-500
      'rgba(6, 182, 212, 0.7)', // cyan-500
      'rgba(14, 165, 233, 0.7)', // sky-500
    ];

    // Assign colors based on position in the array
    const barColors = data.map((_, index) => gradientColors[index % gradientColors.length]);

    return {
      labels,
      datasets: [
        {
          label: 'Tokens Unlocking',
          data,
          backgroundColor: barColors,
          borderColor: 'rgba(54, 162, 235, 0.9)',
          borderWidth: 1,
          hoverBackgroundColor: 'rgba(54, 162, 235, 0.9)',
          hoverBorderColor: 'rgba(54, 162, 235, 1)',
        },
      ],
    };
  }, [unlockSummary]);

  // Memoize chart options
  const chartOptions = useCallback((): ChartOptions => {
    return {
      indexAxis: 'x',
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Token Amount',
            font: {
              weight: 'bold',
            },
          },
          ticks: {
            callback: value => {
              // Format large numbers with K, M, B suffixes
              if (typeof value === 'number') {
                if (value >= 1000000000) {
                  return (value / 1000000000).toFixed(1) + 'B';
                }
                if (value >= 1000000) {
                  return (value / 1000000).toFixed(1) + 'M';
                }
                if (value >= 1000) {
                  return (value / 1000).toFixed(1) + 'K';
                }
                return value;
              }
              return value;
            },
          },
        },
        x: {
          title: {
            display: true,
            text: 'Unlock Date',
            font: {
              weight: 'bold',
            },
          },
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            autoSkip: true,
            maxTicksLimit: 15,
          },
        },
      },
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Future Token Unlock Schedule',
          font: {
            size: 16,
            weight: 'bold',
          },
        },
        tooltip: {
          callbacks: {
            label: context => {
              const value = context.parsed.y;
              return `Tokens: ${formatTokenAmount(value)}`;
            },
          },
        },
      },
      maintainAspectRatio: false,
      animation: {
        duration: 1000,
      },
      responsive: true,
      layout: {
        padding: {
          top: 10,
          right: 10,
          bottom: 30,
          left: 10,
        },
      },
    };
  }, []);

  // Add an effect to clean up any chart instances when the dialog closes
  useEffect(() => {
    if (!unlockSummaryVisible) {
      // Increment the key to force a new chart instance on next open
      setChartKey(prevKey => prevKey + 1);
    }
  }, [unlockSummaryVisible]);

  // Render unlock summary dialog
  const renderUnlockSummaryDialog = () => {
    return (
      <Dialog
        header="Future Token Unlock Summary"
        visible={unlockSummaryVisible}
        style={{ width: '80vw' }}
        onHide={() => {
          setUnlockSummaryVisible(false);
        }}
        maximizable
      >
        <div className="card">
          <div className="mb-3">
            <p className="text-lg">
              This chart shows the scheduled token unlocks from today onwards. It displays the
              amount of tokens that will be eligible for withdrawal on each date.
            </p>
          </div>
          <div style={{ height: '600px', position: 'relative' }}>
            {unlockSummaryVisible && (
              <Chart
                key={`unlock-chart-${chartKey}`}
                type="bar"
                data={prepareChartData()}
                options={chartOptions()}
                plugins={[
                  {
                    id: 'barOptions',
                    beforeInit: (chart: any) => {
                      // Using any type for proper type safety
                      if (!chart.options.datasets) {
                        chart.options.datasets = {};
                      }
                      if (!chart.options.datasets.bar) {
                        chart.options.datasets.bar = {};
                      }
                      chart.options.datasets.bar.barPercentage = 0.9;
                      chart.options.datasets.bar.categoryPercentage = 0.9;
                    },
                  },
                ]}
                style={{ width: '100%', height: '100%' }}
              />
            )}
          </div>
          <div className="mt-5">
            <h5>Detailed Future Unlock Schedule</h5>
            {unlockSummary && unlockSummary.length > 0 ? (
              <>
                <div className="flex justify-content-end mb-3">
                  <div className="p-3 bg-blue-50 border-round">
                    <span className="font-medium">Total Unlockable Tokens: </span>
                    <span className="font-bold text-blue-700">
                      {formatTokenAmount(unlockSummary.reduce((sum, item) => sum + item.amount, 0))}
                    </span>
                  </div>
                </div>
                <DataTable value={unlockSummary} className="p-datatable-sm">
                  <Column
                    field="date"
                    header="Unlock Date"
                    body={rowData => formatDate(rowData.date)}
                  />
                  <Column
                    field="amount"
                    header="Token Amount"
                    body={rowData => formatTokenAmount(rowData.amount)}
                  />
                  <Column
                    field="profiles"
                    header="Social Profiles"
                    body={rowData => {
                      // Collect all wallet addresses that have tokens unlocking on this date
                      const walletsWithUnlocksOnThisDate = stakingData.filter(stakeData =>
                        stakeData.stakes.some(
                          stake =>
                            new Date(stake.unlockDate).toLocaleDateString() ===
                              new Date(rowData.date).toLocaleDateString() && stake.isLocked
                        )
                      );

                      if (walletsWithUnlocksOnThisDate.length === 0) {
                        return <span className="text-muted">-</span>;
                      }

                      return (
                        <div className="flex flex-column gap-2">
                          {walletsWithUnlocksOnThisDate.map((wallet, index) => {
                            const profile = socialProfiles[wallet.walletAddress];
                            // Calculate how many tokens this wallet will get unlocked on this date
                            const unlockAmountOnDate = wallet.stakes
                              .filter(
                                stake =>
                                  new Date(stake.unlockDate).toLocaleDateString() ===
                                    new Date(rowData.date).toLocaleDateString() && stake.isLocked
                              )
                              .reduce((sum, stake) => sum + stake.amount, 0);

                            return (
                              <div
                                key={index}
                                className="flex align-items-center gap-2 p-2 border-bottom-1 border-300"
                              >
                                <div className="flex flex-wrap gap-1">
                                  {profile ? (
                                    <>
                                      {profile.comment && (
                                        <SocialPillComment text={profile.comment} />
                                      )}
                                      {profile.twitter && <SocialPillX handle={profile.twitter} />}
                                      {profile.discord && (
                                        <SocialPillDiscord handle={profile.discord} />
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-xs text-color-secondary">
                                      {wallet.walletAddress.substring(0, 8)}...
                                    </span>
                                  )}
                                </div>
                                <span className="ml-auto font-medium text-color-secondary">
                                  {formatTokenAmount(unlockAmountOnDate)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }}
                  />
                </DataTable>
              </>
            ) : (
              <div className="p-4 text-center">
                <p className="text-lg font-medium text-gray-600">
                  No future unlock data is currently available. This may be because all tokens are
                  already unlocked, or there are no staking records yet.
                </p>
                <Button
                  label="Take New Snapshot"
                  icon="pi pi-camera"
                  className="p-button-outlined mt-3"
                  onClick={() => {
                    setUnlockSummaryVisible(false);
                    takeSnapshot();
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </Dialog>
    );
  };

  return (
    <div className="card p-4">
      <div className="card-header mb-3">
        <h2>Staking Contract: GpUmCRvdKF7EkiufUTCPDvPgy6Fi4GXtrLgLSwLCCyLd</h2>
        <p className="text-secondary">90-day token lock period</p>
      </div>

      {/* Token Summary Stats */}
      <div className="p-3 mb-4 surface-card border-round shadow-2">
        <div className="grid">
          <div className="col-12 md:col-4">
            <div className="text-center p-3 border-round bg-blue-50">
              <h3 className="text-blue-800 mb-1">Total Tokens</h3>
              <div className="text-2xl font-bold text-blue-900">
                {formatTokenAmount(
                  stakingData.reduce((sum, wallet) => sum + wallet.totalStaked, 0)
                )}
              </div>
            </div>
          </div>
          <div className="col-12 md:col-4">
            <div className="text-center p-3 border-round bg-green-50">
              <h3 className="text-green-800 mb-1">Unlocked Tokens</h3>
              <div className="text-2xl font-bold text-green-900">
                {formatTokenAmount(
                  stakingData.reduce((sum, wallet) => sum + wallet.totalUnlocked, 0)
                )}
              </div>
            </div>
          </div>
          <div className="col-12 md:col-4">
            <div className="text-center p-3 border-round bg-yellow-50">
              <h3 className="text-yellow-800 mb-1">Locked Tokens</h3>
              <div className="text-2xl font-bold text-yellow-900">
                {formatTokenAmount(
                  stakingData.reduce((sum, wallet) => sum + wallet.totalLocked, 0)
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-3">
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={handleSearch}
          placeholder="Search by wallet address..."
        />
      </div>

      {loading ? (
        <div className="flex justify-content-center">
          <ProgressSpinner style={{ width: '50px', height: '50px' }} />
        </div>
      ) : (
        <DataTable
          value={stakingData}
          expandedRows={expandedRows}
          onRowToggle={e => setExpandedRows(e.data)}
          rowExpansionTemplate={rowExpansionTemplate}
          dataKey="walletAddress"
          footer={footerTemplate}
          emptyMessage="No staking data found"
          className="p-datatable-sm"
          paginator
          rows={10}
          rowsPerPageOptions={[10, 25, 50]}
        >
          <Column expander style={{ width: '3em' }} />
          <Column field="walletAddress" header="Wallet Address" body={addressTemplate} sortable />
          <Column
            field="socialProfile"
            header="Social Profile"
            body={socialProfileTemplate}
            style={{ minWidth: '200px' }}
          />
          <Column
            field="totalStaked"
            header="Total Staked"
            body={rowData => tokenBalanceTemplate(rowData, 'totalStaked')}
            sortable
            style={{ width: '15%' }}
          />
          <Column
            field="totalLocked"
            header="Locked Tokens"
            body={rowData => tokenBalanceTemplate(rowData, 'totalLocked')}
            sortable
            style={{ width: '15%' }}
          />
          <Column
            field="totalUnlocked"
            header="Unlocked Tokens"
            body={rowData => tokenBalanceTemplate(rowData, 'totalUnlocked')}
            sortable
            style={{ width: '15%' }}
          />
        </DataTable>
      )}

      {renderUnlockSummaryDialog()}
    </div>
  );
};

export default StakingView;
