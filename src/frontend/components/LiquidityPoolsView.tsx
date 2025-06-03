import React, { useEffect, useState } from 'react';

import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { Panel } from 'primereact/panel';
import { ProgressSpinner } from 'primereact/progressspinner';
import { TabPanel, TabView } from 'primereact/tabview';

import {
  LiquidityPoolsAnalysis,
  LiquidityPoolsTransactionAnalysis,
  PlatformAnalysisResponse,
  PoolTokenAnalysis,
  PoolTransactionAnalysis,
} from '../../types/index.js';

import SocialPillComment from './SocialPillComment.js';
import SocialPillDiscord from './SocialPillDiscord.js';
import SocialPillX from './SocialPillX.js';
import WalletAddress from './WalletAddress.js';

interface LiquidityPoolsViewProps {
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

const LiquidityPoolsView: React.FC<LiquidityPoolsViewProps> = ({ onError, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<LiquidityPoolsAnalysis | null>(null);
  const [transactionAnalysis, setTransactionAnalysis] =
    useState<LiquidityPoolsTransactionAnalysis | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [platformData, setPlatformData] = useState<PlatformAnalysisResponse | null>(null);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [expandedRows, setExpandedRows] = useState<any>({});

  const platformOptions = [
    { label: 'All Platforms', value: 'all' },
    { label: 'Orca', value: 'orca' },
    { label: 'Raydium', value: 'raydium' },
    { label: 'Meteora', value: 'meteora' },
  ];

  // Fetch complete analysis
  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/liquidity-pools/analysis');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setAnalysis(data);
      onSuccess('Liquidity pools analysis loaded successfully');
    } catch (error) {
      console.error('Error fetching liquidity pools analysis:', error);
      onError(
        `Failed to load liquidity pools analysis: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch platform-specific analysis
  const fetchPlatformAnalysis = async (platform: string) => {
    if (platform === 'all') {
      setPlatformData(null);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/liquidity-pools/platform/${platform}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setPlatformData(data);
    } catch (error) {
      console.error(`Error fetching ${platform} analysis:`, error);
      onError(
        `Failed to load ${platform} analysis: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch transaction flow analysis (RPC-based, comprehensive but slower)
  const fetchTransactionAnalysis = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/liquidity-pools/transactions');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setTransactionAnalysis(data);
      onSuccess('Comprehensive liquidity pools transaction analysis completed successfully');
    } catch (error) {
      console.error('Error fetching liquidity pools transaction analysis:', error);
      onError(
        `Failed to load liquidity pools transaction analysis: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch transaction flow analysis using BitQuery (faster alternative)
  const fetchBitQueryTransactionAnalysis = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/liquidity-pools/transactions-bitquery');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setTransactionAnalysis(data);
      onSuccess(
        'BitQuery-based liquidity pools transaction analysis completed successfully (much faster!)'
      );
    } catch (error) {
      console.error('Error fetching BitQuery liquidity pools transaction analysis:', error);
      onError(
        `Failed to load BitQuery liquidity pools transaction analysis: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, []);

  useEffect(() => {
    if (selectedPlatform !== 'all') {
      fetchPlatformAnalysis(selectedPlatform);
    } else {
      setPlatformData(null);
    }
  }, [selectedPlatform]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatTokenAmount = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(2)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(2)}K`;
    }
    return formatNumber(tokens);
  };

  const poolBodyTemplate = (rowData: PoolTokenAnalysis) => (
    <WalletAddress address={rowData.poolAddress} />
  );

  const tokensBodyTemplate = (rowData: PoolTokenAnalysis) => (
    <span className="font-semibold">{formatTokenAmount(rowData.totalTokens)}</span>
  );

  const walletsBodyTemplate = (rowData: PoolTokenAnalysis) => (
    <span>{formatNumber(rowData.uniqueWallets)}</span>
  );

  const walletBodyTemplate = (rowData: any) => <WalletAddress address={rowData.address} />;

  const platformsBodyTemplate = (rowData: any) => (
    <div className="flex gap-1 flex-wrap">
      {rowData.platforms.map((platform: string) => (
        <span key={platform} className={`platform-badge platform-${platform}`}>
          {platform}
        </span>
      ))}
    </div>
  );

  // Social profile template
  const socialProfileTemplate = (rowData: any) => {
    if (!rowData.twitter && !rowData.discord && !rowData.comment) {
      return <span className="text-color-secondary">-</span>;
    }

    return (
      <div className="flex flex-wrap gap-1">
        {rowData.comment && <SocialPillComment text={rowData.comment} />}
        {rowData.twitter && <SocialPillX handle={rowData.twitter} />}
        {rowData.discord && <SocialPillDiscord handle={rowData.discord} />}
      </div>
    );
  };

  // Row expansion template for wallet details
  const walletRowExpansionTemplate = (data: any) => {
    if (!data || !data.address) {
      return (
        <div className="p-3">
          <p className="text-color-secondary">No data available for this wallet.</p>
        </div>
      );
    }

    try {
      return (
        <div className="p-3">
          <h5 className="mb-3">$GP Token Distribution Details for {data.address}</h5>

          {/* Platform Breakdown */}
          <Panel header="Platform Breakdown" className="mb-3">
            <div className="grid">
              {Object.entries(data.poolBreakdown || {}).map(
                ([platform, breakdown]: [string, any]) => (
                  <div key={platform} className="col-12 md:col-6 lg:col-4">
                    <Card className="h-full">
                      <div className="flex align-items-center justify-content-between mb-2">
                        <h6 className="m-0 capitalize">{platform}</h6>
                        <span className={`platform-badge platform-${platform}`}>{platform}</span>
                      </div>
                      <div className="mb-2">
                        <strong>Tokens:</strong> {formatTokenAmount(breakdown?.tokens || 0)}
                      </div>
                      <div>
                        <strong>Pools:</strong>
                        <div className="mt-1">
                          {Array.isArray(breakdown?.pools) ? (
                            breakdown.pools.map((poolAddr: string, idx: number) => (
                              <div key={idx} className="text-sm">
                                <WalletAddress address={poolAddr} />
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-color-secondary">No pools</div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>
                )
              )}
              {Object.keys(data.poolBreakdown || {}).length === 0 && (
                <div className="col-12">
                  <p className="text-color-secondary">No platform breakdown available.</p>
                </div>
              )}
            </div>
          </Panel>

          {/* Social Profile Info */}
          {(data.twitter || data.discord || data.comment) && (
            <Panel header="Social Profile" className="mb-3">
              <div className="grid">
                {data.twitter && (
                  <div className="col-12 md:col-4">
                    <strong>Twitter:</strong> <SocialPillX handle={data.twitter} />
                  </div>
                )}
                {data.discord && (
                  <div className="col-12 md:col-4">
                    <strong>Discord:</strong> <SocialPillDiscord handle={data.discord} />
                  </div>
                )}
                {data.comment && (
                  <div className="col-12">
                    <strong>Comment:</strong> <SocialPillComment text={data.comment} />
                  </div>
                )}
              </div>
            </Panel>
          )}
        </div>
      );
    } catch (error) {
      console.error('Error rendering wallet row expansion:', error);
      return (
        <div className="p-3">
          <p className="text-color-secondary">Error loading wallet details.</p>
        </div>
      );
    }
  };

  if (loading && !analysis) {
    return (
      <div className="flex justify-content-center align-items-center" style={{ height: '400px' }}>
        <ProgressSpinner />
      </div>
    );
  }

  return (
    <div className="liquidity-pools-view">
      <div className="flex justify-content-between align-items-center mb-4">
        <h2>Liquidity Pools Analysis</h2>
        <div className="flex gap-2 align-items-center">
          <Dropdown
            value={selectedPlatform}
            options={platformOptions}
            onChange={e => setSelectedPlatform(e.value)}
            placeholder="Select Platform"
            className="w-12rem"
          />
          <Button
            icon="pi pi-refresh"
            onClick={fetchAnalysis}
            loading={loading}
            tooltip="Refresh Analysis"
          />
          <Button
            icon="pi pi-arrow-right-arrow-left"
            onClick={fetchTransactionAnalysis}
            loading={loading}
            tooltip="Comprehensive RPC-based Analysis (Slow but complete - may take several minutes)"
            className="p-button-outlined"
            label="RPC Analysis"
          />
          <Button
            icon="pi pi-flash"
            onClick={fetchBitQueryTransactionAnalysis}
            loading={loading}
            tooltip="BitQuery-based Analysis (Fast alternative using DEX APIs - seconds not minutes)"
            className="p-button-outlined p-button-success"
            label="BitQuery Analysis"
          />
        </div>
      </div>

      {analysis && (
        <>
          {/* Summary Cards */}
          <div className="grid mb-4">
            <div className="col-12 md:col-3">
              <Card className="text-center">
                <h3 className="text-3xl font-bold text-primary mb-2">
                  {formatTokenAmount(analysis.totalAnalysis.totalTokensAcrossPlatforms)}
                </h3>
                <p className="text-color-secondary">Total Tokens</p>
              </Card>
            </div>
            <div className="col-12 md:col-3">
              <Card className="text-center">
                <h3 className="text-3xl font-bold text-primary mb-2">
                  {formatNumber(analysis.totalAnalysis.totalUniqueWallets)}
                </h3>
                <p className="text-color-secondary">Unique Wallets</p>
              </Card>
            </div>
            <div className="col-12 md:col-3">
              <Card className="text-center">
                <h3 className="text-3xl font-bold text-primary mb-2">
                  {Object.keys(analysis.totalAnalysis.platformBreakdown).length}
                </h3>
                <p className="text-color-secondary">Platforms</p>
              </Card>
            </div>
            <div className="col-12 md:col-3">
              <Card className="text-center">
                <h3 className="text-3xl font-bold text-primary mb-2">
                  {analysis.orca.length + analysis.raydium.length + analysis.meteora.length}
                </h3>
                <p className="text-color-secondary">Total Pools</p>
              </Card>
            </div>
          </div>

          {/* Platform Breakdown */}
          <Panel header="Platform Breakdown" className="mb-4">
            <div className="grid">
              {Object.entries(analysis.totalAnalysis.platformBreakdown).map(([platform, data]) => (
                <div key={platform} className="col-12 md:col-4">
                  <Card className="h-full">
                    <div className="flex align-items-center justify-content-between mb-3">
                      <h4 className="m-0 capitalize">{platform}</h4>
                      <span className={`platform-badge platform-${platform}`}>{platform}</span>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary mb-2">
                        {formatTokenAmount(data.totalTokens)}
                      </div>
                      <p className="text-sm text-color-secondary mb-2">Tokens</p>
                      <div className="text-xl font-semibold mb-1">
                        {formatNumber(data.uniqueWallets)}
                      </div>
                      <p className="text-sm text-color-secondary">Wallets</p>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          </Panel>

          {/* Detailed Analysis */}
          <TabView activeIndex={activeTabIndex} onTabChange={e => setActiveTabIndex(e.index)}>
            <TabPanel header="Top Wallets">
              <DataTable
                value={
                  Array.isArray(analysis.totalAnalysis.topWallets)
                    ? analysis.totalAnalysis.topWallets
                    : []
                }
                paginator
                rows={25}
                loading={loading}
                emptyMessage="No wallet data available"
                sortMode="multiple"
                removableSort
                dataKey="address"
              >
                <Column
                  field="address"
                  header="Wallet Address"
                  body={walletBodyTemplate}
                  sortable
                />
                <Column
                  field="totalTokens"
                  header="Total Tokens"
                  body={rowData => (
                    <span className="font-semibold">{formatTokenAmount(rowData.totalTokens)}</span>
                  )}
                  sortable
                />
                <Column field="platforms" header="Platforms" body={platformsBodyTemplate} />
                <Column field="social" header="Social Profiles" body={socialProfileTemplate} />
              </DataTable>
            </TabPanel>

            <TabPanel header="Wallet Details">
              <DataTable
                value={
                  Array.isArray(analysis.totalAnalysis.walletDetails)
                    ? analysis.totalAnalysis.walletDetails
                    : []
                }
                paginator
                rows={25}
                loading={loading}
                emptyMessage="No wallet details available"
                sortMode="multiple"
                removableSort
                dataKey="address"
                expandedRows={expandedRows}
                onRowToggle={e => setExpandedRows(e.data)}
                rowExpansionTemplate={walletRowExpansionTemplate}
              >
                <Column expander style={{ width: '3rem' }} />
                <Column
                  field="address"
                  header="Wallet Address"
                  body={walletBodyTemplate}
                  sortable
                />
                <Column
                  field="totalTokens"
                  header="Total $GP Tokens"
                  body={rowData => (
                    <span className="font-semibold">{formatTokenAmount(rowData.totalTokens)}</span>
                  )}
                  sortable
                />
                <Column field="platforms" header="Platforms" body={platformsBodyTemplate} />
                <Column field="social" header="Social Profiles" body={socialProfileTemplate} />
              </DataTable>
            </TabPanel>

            <TabPanel header="Orca Pools">
              <DataTable
                value={Array.isArray(analysis.orca) ? analysis.orca : []}
                paginator
                rows={25}
                loading={loading}
                emptyMessage="No Orca pool data available"
                sortMode="multiple"
                removableSort
                dataKey="poolAddress"
              >
                <Column field="poolAddress" header="Pool Address" body={poolBodyTemplate} />
                <Column
                  field="totalTokens"
                  header="Total Tokens"
                  body={tokensBodyTemplate}
                  sortable
                />
                <Column
                  field="uniqueWallets"
                  header="Unique Wallets"
                  body={walletsBodyTemplate}
                  sortable
                />
              </DataTable>
            </TabPanel>

            <TabPanel header="Raydium Pools">
              <DataTable
                value={Array.isArray(analysis.raydium) ? analysis.raydium : []}
                paginator
                rows={25}
                loading={loading}
                emptyMessage="No Raydium pool data available"
                sortMode="multiple"
                removableSort
                dataKey="poolAddress"
              >
                <Column field="poolAddress" header="Pool Address" body={poolBodyTemplate} />
                <Column
                  field="totalTokens"
                  header="Total Tokens"
                  body={tokensBodyTemplate}
                  sortable
                />
                <Column
                  field="uniqueWallets"
                  header="Unique Wallets"
                  body={walletsBodyTemplate}
                  sortable
                />
              </DataTable>
            </TabPanel>

            <TabPanel header="Meteora Pools">
              <DataTable
                value={Array.isArray(analysis.meteora) ? analysis.meteora : []}
                paginator
                rows={25}
                loading={loading}
                emptyMessage="No Meteora pool data available"
                sortMode="multiple"
                removableSort
                dataKey="poolAddress"
              >
                <Column field="poolAddress" header="Pool Address" body={poolBodyTemplate} />
                <Column
                  field="totalTokens"
                  header="Total Tokens"
                  body={tokensBodyTemplate}
                  sortable
                />
                <Column
                  field="uniqueWallets"
                  header="Unique Wallets"
                  body={walletsBodyTemplate}
                  sortable
                />
              </DataTable>
            </TabPanel>

            {/* Transaction Flow Analysis Tabs */}
            {transactionAnalysis && (
              <>
                <TabPanel header="Token Contributors">
                  <div className="mb-4">
                    <Panel header="Transaction Flow Summary" className="mb-3">
                      <div className="grid">
                        <div className="col-12 md:col-3">
                          <Card className="text-center">
                            <h3 className="text-2xl font-bold text-green-500 mb-2">
                              {formatTokenAmount(transactionAnalysis.totalAnalysis.totalInflows)}
                            </h3>
                            <p className="text-color-secondary">Total Inflows</p>
                          </Card>
                        </div>
                        <div className="col-12 md:col-3">
                          <Card className="text-center">
                            <h3 className="text-2xl font-bold text-orange-500 mb-2">
                              {formatTokenAmount(transactionAnalysis.totalAnalysis.totalOutflows)}
                            </h3>
                            <p className="text-color-secondary">Total Outflows</p>
                          </Card>
                        </div>
                        <div className="col-12 md:col-3">
                          <Card className="text-center">
                            <h3 className="text-2xl font-bold text-primary mb-2">
                              {transactionAnalysis.totalAnalysis.topContributors.length}
                            </h3>
                            <p className="text-color-secondary">Contributors</p>
                          </Card>
                        </div>
                        <div className="col-12 md:col-3">
                          <Card className="text-center">
                            <h3 className="text-2xl font-bold text-primary mb-2">
                              {formatTokenAmount(
                                transactionAnalysis.totalAnalysis.totalInflows -
                                  transactionAnalysis.totalAnalysis.totalOutflows
                              )}
                            </h3>
                            <p className="text-color-secondary">Net Flow</p>
                          </Card>
                        </div>
                      </div>
                    </Panel>
                  </div>

                  <DataTable
                    value={
                      Array.isArray(transactionAnalysis.totalAnalysis.topContributors)
                        ? transactionAnalysis.totalAnalysis.topContributors
                        : []
                    }
                    paginator
                    rows={25}
                    loading={loading}
                    emptyMessage="No contributor data available"
                    sortMode="multiple"
                    removableSort
                    dataKey="address"
                  >
                    <Column
                      field="address"
                      header="Contributor Address"
                      body={walletBodyTemplate}
                      sortable
                    />
                    <Column
                      field="totalContributed"
                      header="Total Contributed"
                      body={rowData => (
                        <span className="font-semibold text-green-500">
                          {formatTokenAmount(rowData.totalContributed)}
                        </span>
                      )}
                      sortable
                    />
                    <Column
                      field="totalReceived"
                      header="Total Received"
                      body={rowData => (
                        <span className="font-semibold text-orange-500">
                          {formatTokenAmount(rowData.totalReceived)}
                        </span>
                      )}
                      sortable
                    />
                    <Column
                      field="netContribution"
                      header="Net Contribution"
                      body={rowData => (
                        <span
                          className={`font-semibold ${rowData.netContribution > 0 ? 'text-green-500' : rowData.netContribution < 0 ? 'text-red-500' : 'text-gray-500'}`}
                        >
                          {rowData.netContribution > 0 ? '+' : ''}
                          {formatTokenAmount(rowData.netContribution)}
                        </span>
                      )}
                      sortable
                    />
                    <Column field="platforms" header="Platforms" body={platformsBodyTemplate} />
                    <Column field="social" header="Social Profiles" body={socialProfileTemplate} />
                  </DataTable>
                </TabPanel>

                <TabPanel header="Pool Flow Details">
                  <TabView>
                    <TabPanel header="Orca Flows">
                      {transactionAnalysis.orca.map(
                        (pool: PoolTransactionAnalysis, index: number) => (
                          <Panel
                            key={pool.poolAddress}
                            header={`Pool: ${pool.poolAddress.slice(0, 8)}...${pool.poolAddress.slice(-4)}`}
                            className="mb-3"
                          >
                            <div className="grid mb-3">
                              <div className="col-12 md:col-4">
                                <Card className="text-center">
                                  <h4 className="text-green-500 mb-2">Inflows</h4>
                                  <div className="text-xl font-bold">
                                    {formatTokenAmount(pool.totalInflow)}
                                  </div>
                                  <div className="text-sm text-color-secondary">
                                    {pool.inflows.length} transactions
                                  </div>
                                </Card>
                              </div>
                              <div className="col-12 md:col-4">
                                <Card className="text-center">
                                  <h4 className="text-orange-500 mb-2">Outflows</h4>
                                  <div className="text-xl font-bold">
                                    {formatTokenAmount(pool.totalOutflow)}
                                  </div>
                                  <div className="text-sm text-color-secondary">
                                    {pool.outflows.length} transactions
                                  </div>
                                </Card>
                              </div>
                              <div className="col-12 md:col-4">
                                <Card className="text-center">
                                  <h4 className="text-primary mb-2">Contributors</h4>
                                  <div className="text-xl font-bold">{pool.uniqueContributors}</div>
                                  <div className="text-sm text-color-secondary">
                                    unique addresses
                                  </div>
                                </Card>
                              </div>
                            </div>

                            <DataTable
                              value={
                                Array.isArray(Object.values(pool.contributorBreakdown))
                                  ? (Object.values(pool.contributorBreakdown) as any[])
                                  : []
                              }
                              rows={10}
                              emptyMessage="No contributors found"
                              sortMode="multiple"
                              removableSort
                            >
                              <Column
                                field="address"
                                header="Address"
                                body={(rowData: any) => <WalletAddress address={rowData.address} />}
                              />
                              <Column
                                field="totalInflow"
                                header="Contributed"
                                body={(rowData: any) => (
                                  <span className="text-green-500 font-semibold">
                                    {formatTokenAmount(rowData.totalInflow)}
                                  </span>
                                )}
                                sortable
                              />
                              <Column
                                field="totalOutflow"
                                header="Received"
                                body={(rowData: any) => (
                                  <span className="text-orange-500 font-semibold">
                                    {formatTokenAmount(rowData.totalOutflow)}
                                  </span>
                                )}
                                sortable
                              />
                              <Column
                                field="netContribution"
                                header="Net"
                                body={(rowData: any) => (
                                  <span
                                    className={`font-semibold ${rowData.netContribution > 0 ? 'text-green-500' : rowData.netContribution < 0 ? 'text-red-500' : 'text-gray-500'}`}
                                  >
                                    {rowData.netContribution > 0 ? '+' : ''}
                                    {formatTokenAmount(rowData.netContribution)}
                                  </span>
                                )}
                                sortable
                              />
                              <Column
                                field="social"
                                header="Social"
                                body={(rowData: any) => {
                                  if (!rowData.twitter && !rowData.discord && !rowData.comment) {
                                    return <span className="text-color-secondary">-</span>;
                                  }
                                  return (
                                    <div className="flex flex-wrap gap-1">
                                      {rowData.comment && (
                                        <SocialPillComment text={rowData.comment} />
                                      )}
                                      {rowData.twitter && <SocialPillX handle={rowData.twitter} />}
                                      {rowData.discord && (
                                        <SocialPillDiscord handle={rowData.discord} />
                                      )}
                                    </div>
                                  );
                                }}
                              />
                            </DataTable>
                          </Panel>
                        )
                      )}
                    </TabPanel>

                    <TabPanel header="Raydium Flows">
                      {transactionAnalysis.raydium.map(
                        (pool: PoolTransactionAnalysis, index: number) => (
                          <Panel
                            key={pool.poolAddress}
                            header={`Pool: ${pool.poolAddress.slice(0, 8)}...${pool.poolAddress.slice(-4)}`}
                            className="mb-3"
                          >
                            <div className="grid mb-3">
                              <div className="col-12 md:col-4">
                                <Card className="text-center">
                                  <h4 className="text-green-500 mb-2">Inflows</h4>
                                  <div className="text-xl font-bold">
                                    {formatTokenAmount(pool.totalInflow)}
                                  </div>
                                  <div className="text-sm text-color-secondary">
                                    {pool.inflows.length} transactions
                                  </div>
                                </Card>
                              </div>
                              <div className="col-12 md:col-4">
                                <Card className="text-center">
                                  <h4 className="text-orange-500 mb-2">Outflows</h4>
                                  <div className="text-xl font-bold">
                                    {formatTokenAmount(pool.totalOutflow)}
                                  </div>
                                  <div className="text-sm text-color-secondary">
                                    {pool.outflows.length} transactions
                                  </div>
                                </Card>
                              </div>
                              <div className="col-12 md:col-4">
                                <Card className="text-center">
                                  <h4 className="text-primary mb-2">Contributors</h4>
                                  <div className="text-xl font-bold">{pool.uniqueContributors}</div>
                                  <div className="text-sm text-color-secondary">
                                    unique addresses
                                  </div>
                                </Card>
                              </div>
                            </div>

                            <DataTable
                              value={
                                Array.isArray(Object.values(pool.contributorBreakdown))
                                  ? (Object.values(pool.contributorBreakdown) as any[])
                                  : []
                              }
                              rows={10}
                              emptyMessage="No contributors found"
                              sortMode="multiple"
                              removableSort
                            >
                              <Column
                                field="address"
                                header="Address"
                                body={(rowData: any) => <WalletAddress address={rowData.address} />}
                              />
                              <Column
                                field="totalInflow"
                                header="Contributed"
                                body={(rowData: any) => (
                                  <span className="text-green-500 font-semibold">
                                    {formatTokenAmount(rowData.totalInflow)}
                                  </span>
                                )}
                                sortable
                              />
                              <Column
                                field="totalOutflow"
                                header="Received"
                                body={(rowData: any) => (
                                  <span className="text-orange-500 font-semibold">
                                    {formatTokenAmount(rowData.totalOutflow)}
                                  </span>
                                )}
                                sortable
                              />
                              <Column
                                field="netContribution"
                                header="Net"
                                body={(rowData: any) => (
                                  <span
                                    className={`font-semibold ${rowData.netContribution > 0 ? 'text-green-500' : rowData.netContribution < 0 ? 'text-red-500' : 'text-gray-500'}`}
                                  >
                                    {rowData.netContribution > 0 ? '+' : ''}
                                    {formatTokenAmount(rowData.netContribution)}
                                  </span>
                                )}
                                sortable
                              />
                              <Column
                                field="social"
                                header="Social"
                                body={(rowData: any) => {
                                  if (!rowData.twitter && !rowData.discord && !rowData.comment) {
                                    return <span className="text-color-secondary">-</span>;
                                  }
                                  return (
                                    <div className="flex flex-wrap gap-1">
                                      {rowData.comment && (
                                        <SocialPillComment text={rowData.comment} />
                                      )}
                                      {rowData.twitter && <SocialPillX handle={rowData.twitter} />}
                                      {rowData.discord && (
                                        <SocialPillDiscord handle={rowData.discord} />
                                      )}
                                    </div>
                                  );
                                }}
                              />
                            </DataTable>
                          </Panel>
                        )
                      )}
                    </TabPanel>

                    <TabPanel header="Meteora Flows">
                      {transactionAnalysis.meteora.map(
                        (pool: PoolTransactionAnalysis, index: number) => (
                          <Panel
                            key={pool.poolAddress}
                            header={`Pool: ${pool.poolAddress.slice(0, 8)}...${pool.poolAddress.slice(-4)}`}
                            className="mb-3"
                          >
                            <div className="grid mb-3">
                              <div className="col-12 md:col-4">
                                <Card className="text-center">
                                  <h4 className="text-green-500 mb-2">Inflows</h4>
                                  <div className="text-xl font-bold">
                                    {formatTokenAmount(pool.totalInflow)}
                                  </div>
                                  <div className="text-sm text-color-secondary">
                                    {pool.inflows.length} transactions
                                  </div>
                                </Card>
                              </div>
                              <div className="col-12 md:col-4">
                                <Card className="text-center">
                                  <h4 className="text-orange-500 mb-2">Outflows</h4>
                                  <div className="text-xl font-bold">
                                    {formatTokenAmount(pool.totalOutflow)}
                                  </div>
                                  <div className="text-sm text-color-secondary">
                                    {pool.outflows.length} transactions
                                  </div>
                                </Card>
                              </div>
                              <div className="col-12 md:col-4">
                                <Card className="text-center">
                                  <h4 className="text-primary mb-2">Contributors</h4>
                                  <div className="text-xl font-bold">{pool.uniqueContributors}</div>
                                  <div className="text-sm text-color-secondary">
                                    unique addresses
                                  </div>
                                </Card>
                              </div>
                            </div>

                            <DataTable
                              value={
                                Array.isArray(Object.values(pool.contributorBreakdown))
                                  ? (Object.values(pool.contributorBreakdown) as any[])
                                  : []
                              }
                              rows={10}
                              emptyMessage="No contributors found"
                              sortMode="multiple"
                              removableSort
                            >
                              <Column
                                field="address"
                                header="Address"
                                body={(rowData: any) => <WalletAddress address={rowData.address} />}
                              />
                              <Column
                                field="totalInflow"
                                header="Contributed"
                                body={(rowData: any) => (
                                  <span className="text-green-500 font-semibold">
                                    {formatTokenAmount(rowData.totalInflow)}
                                  </span>
                                )}
                                sortable
                              />
                              <Column
                                field="totalOutflow"
                                header="Received"
                                body={(rowData: any) => (
                                  <span className="text-orange-500 font-semibold">
                                    {formatTokenAmount(rowData.totalOutflow)}
                                  </span>
                                )}
                                sortable
                              />
                              <Column
                                field="netContribution"
                                header="Net"
                                body={(rowData: any) => (
                                  <span
                                    className={`font-semibold ${rowData.netContribution > 0 ? 'text-green-500' : rowData.netContribution < 0 ? 'text-red-500' : 'text-gray-500'}`}
                                  >
                                    {rowData.netContribution > 0 ? '+' : ''}
                                    {formatTokenAmount(rowData.netContribution)}
                                  </span>
                                )}
                                sortable
                              />
                              <Column
                                field="social"
                                header="Social"
                                body={(rowData: any) => {
                                  if (!rowData.twitter && !rowData.discord && !rowData.comment) {
                                    return <span className="text-color-secondary">-</span>;
                                  }
                                  return (
                                    <div className="flex flex-wrap gap-1">
                                      {rowData.comment && (
                                        <SocialPillComment text={rowData.comment} />
                                      )}
                                      {rowData.twitter && <SocialPillX handle={rowData.twitter} />}
                                      {rowData.discord && (
                                        <SocialPillDiscord handle={rowData.discord} />
                                      )}
                                    </div>
                                  );
                                }}
                              />
                            </DataTable>
                          </Panel>
                        )
                      )}
                    </TabPanel>
                  </TabView>
                </TabPanel>
              </>
            )}
          </TabView>
        </>
      )}

      <style>{`
        .platform-badge {
          padding: 0.25rem 0.5rem;
          border-radius: 0.375rem;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        .platform-orca {
          background-color: #3b82f6;
          color: white;
        }
        .platform-raydium {
          background-color: #8b5cf6;
          color: white;
        }
        .platform-meteora {
          background-color: #f59e0b;
          color: white;
        }
      `}</style>
    </div>
  );
};

export default LiquidityPoolsView;
