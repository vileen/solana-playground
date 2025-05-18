import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useEffect, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { InputText } from 'primereact/inputtext';
import { Dialog } from 'primereact/dialog';
import { TabView, TabPanel } from 'primereact/tabview';
import './App.css';
const App = () => {
    const [holders, setHolders] = useState([]);
    const [tokenHolders, setTokenHolders] = useState([]);
    const [socialHolders, setSocialHolders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedRows, setExpandedRows] = useState(null);
    const [socialDialogVisible, setSocialDialogVisible] = useState(false);
    const [selectedHolder, setSelectedHolder] = useState(null);
    const [twitterHandle, setTwitterHandle] = useState('');
    const [discordHandle, setDiscordHandle] = useState('');
    const [comment, setComment] = useState('');
    const [activeTab, setActiveTab] = useState(0);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const toast = React.useRef(null);
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme-preference');
        if (savedTheme) {
            setIsDarkMode(savedTheme === 'dark');
        }
        loadThemeCSS(savedTheme === 'light' ? false : true);
    }, []);
    const loadThemeCSS = (dark) => {
        const themeLink = document.getElementById('app-theme');
        if (themeLink) {
            themeLink.href = `https://cdn.jsdelivr.net/npm/primereact@9/resources/themes/lara-${dark ? 'dark' : 'light'}-indigo/theme.css`;
        }
        else {
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
        return process.env.VITE_API_URL || 'http://localhost:3001/api';
    };
    const fetchHolders = async () => {
        try {
            setLoading(true);
            const url = new URL(`${getApiUrl()}/holders`);
            if (searchTerm) {
                url.searchParams.append('search', searchTerm);
            }
            const response = await fetch(url.toString());
            if (!response.ok)
                throw new Error('Failed to fetch holders');
            const data = await response.json();
            setHolders(data);
        }
        catch (error) {
            console.error('Error fetching holders:', error);
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to fetch holders',
                life: 3000
            });
        }
        finally {
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
            const response = await fetch(url.toString());
            if (!response.ok)
                throw new Error('Failed to fetch token holders');
            const data = await response.json();
            setTokenHolders(data);
        }
        catch (error) {
            console.error('Error fetching token holders:', error);
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to fetch token holders',
                life: 3000
            });
        }
        finally {
            setLoading(false);
        }
    };
    const fetchSocialProfiles = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${getApiUrl()}/social-profiles`);
            if (!response.ok)
                throw new Error('Failed to fetch social profiles');
            const data = await response.json();
            setSocialHolders(data);
        }
        catch (error) {
            console.error('Error fetching social profiles:', error);
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to fetch social profiles',
                life: 3000
            });
        }
        finally {
            setLoading(false);
        }
    };
    const takeSnapshot = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${getApiUrl()}/snapshot`);
            if (!response.ok)
                throw new Error('Failed to take snapshot');
            const data = await response.json();
            setHolders(data.holders);
            toast.current?.show({
                severity: 'success',
                summary: 'Success',
                detail: 'NFT snapshot taken successfully',
                life: 3000
            });
        }
        catch (error) {
            console.error('Error taking snapshot:', error);
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to take snapshot',
                life: 3000
            });
        }
        finally {
            setLoading(false);
        }
    };
    const takeTokenSnapshot = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${getApiUrl()}/token-snapshot`);
            if (!response.ok)
                throw new Error('Failed to take token snapshot');
            const data = await response.json();
            setTokenHolders(data.holders);
            toast.current?.show({
                severity: 'success',
                summary: 'Success',
                detail: 'Token snapshot taken successfully',
                life: 3000
            });
        }
        catch (error) {
            console.error('Error taking token snapshot:', error);
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to take token snapshot',
                life: 3000
            });
        }
        finally {
            setLoading(false);
        }
    };
    const saveSocialProfile = async () => {
        if (!selectedHolder)
            return;
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
            if (!response.ok)
                throw new Error('Failed to save social profile');
            const data = await response.json();
            if (data.success) {
                if (activeTab === 0) {
                    await fetchHolders();
                }
                else if (activeTab === 1) {
                    await fetchTokenHolders();
                }
                else if (activeTab === 2) {
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
        }
        catch (error) {
            console.error('Error saving social profile:', error);
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to save social profile',
                life: 3000
            });
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        if (activeTab === 0) {
            fetchHolders();
        }
        else if (activeTab === 1) {
            fetchTokenHolders();
        }
        else if (activeTab === 2) {
            fetchSocialProfiles();
        }
    }, [activeTab, searchTerm]);
    const addressTemplate = (rowData) => (_jsx("a", { href: `https://solscan.io/account/${rowData.address}`, target: "_blank", rel: "noopener noreferrer", children: rowData.address }));
    const rowExpansionTemplate = (holder) => (_jsxs(DataTable, { value: holder.nfts, responsiveLayout: "scroll", className: "p-datatable-sm", children: [_jsx(Column, { field: "mint", header: "Mint" }), _jsx(Column, { field: "name", header: "Name" }), _jsx(Column, { field: "type", header: "Collection" })] }));
    const socialActionsTemplate = (rowData) => (_jsx(Button, { icon: "pi pi-user-edit", className: "p-button-rounded p-button-info p-button-sm", onClick: () => {
            setSelectedHolder(rowData);
            setTwitterHandle(rowData.socialProfiles?.twitter || '');
            setDiscordHandle(rowData.socialProfiles?.discord || '');
            setComment(rowData.socialProfiles?.comment || '');
            setSocialDialogVisible(true);
        }, tooltip: "Add/Edit Social Info", tooltipOptions: { position: 'top', showDelay: 50 } }));
    const twitterTemplate = (rowData) => {
        if (!rowData.socialProfiles?.twitter)
            return 'N/A';
        return (_jsxs("a", { href: `https://twitter.com/${rowData.socialProfiles.twitter}`, target: "_blank", rel: "noopener noreferrer", className: "social-link twitter", children: ["@", rowData.socialProfiles.twitter] }));
    };
    const discordTemplate = (rowData) => {
        return rowData.socialProfiles?.discord || 'N/A';
    };
    const tokenBalanceTemplate = (rowData) => {
        return rowData.balance ? rowData.balance.toLocaleString() : 'N/A';
    };
    const formatTokenBalance = (value) => {
        return value.toLocaleString();
    };
    const socialInfoTemplate = (rowData) => {
        if (rowData.socialProfiles?.twitter) {
            return (_jsxs("a", { href: `https://twitter.com/${rowData.socialProfiles.twitter}`, target: "_blank", rel: "noopener noreferrer", className: "social-link twitter", children: ["@", rowData.socialProfiles.twitter] }));
        }
        else if (rowData.socialProfiles?.comment) {
            return _jsx("span", { title: rowData.socialProfiles.comment, children: rowData.socialProfiles.comment });
        }
        return 'N/A';
    };
    const getRowClassName = (rowData) => {
        return (rowData.socialProfiles?.twitter ||
            rowData.socialProfiles?.discord ||
            rowData.socialProfiles?.comment)
            ? 'has-social-profile'
            : '';
    };
    return (_jsxs("div", { className: `${isDarkMode ? 'dark-theme' : 'light-theme'}`, children: [_jsx("style", { children: `
          .p-datatable-tbody > tr.has-social-profile {
            background-color: ${isDarkMode ? 'rgba(25, 118, 210, 0.25)' : 'rgba(227, 242, 253, 0.9)'} !important;
          }
          .p-datatable-tbody > tr.has-social-profile > td {
            background-color: transparent !important;
          }
        ` }), _jsx("div", { className: "theme-switcher", children: _jsx(Button, { icon: isDarkMode ? 'pi pi-sun' : 'pi pi-moon', onClick: toggleTheme, className: "p-button-rounded p-button-text", tooltip: isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode", tooltipOptions: { position: 'bottom' }, "aria-label": "Toggle Theme" }) }), _jsx(Toast, { ref: toast }), _jsxs(TabView, { activeIndex: activeTab, onTabChange: (e) => setActiveTab(e.index), children: [_jsxs(TabPanel, { header: "NFT Holders", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h1", { className: "text-2xl font-bold", children: "NFT Collection Holders" }), _jsxs("div", { className: "flex gap-4 items-center", children: [_jsxs("span", { className: "p-input-icon-left search-input-wrapper", children: [_jsx("i", { className: "pi pi-search" }), _jsx(InputText, { value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), placeholder: "Search by address...", className: "p-inputtext-sm", style: { width: '250px' } })] }), _jsx(Button, { label: "Take Snapshot", icon: "pi pi-camera", onClick: takeSnapshot, loading: loading, className: "ml-2" })] })] }), _jsxs(DataTable, { value: holders, loading: loading, paginator: true, rows: 10, expandedRows: expandedRows, onRowToggle: e => setExpandedRows(e.data), rowExpansionTemplate: rowExpansionTemplate, dataKey: "address", className: "p-datatable-sm", sortField: "gen1Count", sortOrder: -1, removableSort: false, rowClassName: getRowClassName, children: [_jsx(Column, { expander: true, style: { width: '3em' } }), _jsx(Column, { field: "address", header: "Address", body: addressTemplate, sortable: true }), _jsx(Column, { field: "gen1Count", header: "Gen1 Count", sortable: true }), _jsx(Column, { field: "infantCount", header: "Infant Count", sortable: true }), _jsx(Column, { field: "nftCount", header: "Total NFTs", sortable: true }), _jsx(Column, { header: "Social Info", body: socialInfoTemplate, style: { minWidth: '200px' }, sortable: false }), _jsx(Column, { body: socialActionsTemplate, style: { width: '5em' }, header: "Actions" })] })] }), _jsxs(TabPanel, { header: "Token Holders", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Token Holders" }), _jsxs("div", { className: "flex gap-4 items-center", children: [_jsxs("span", { className: "p-input-icon-left search-input-wrapper", children: [_jsx("i", { className: "pi pi-search" }), _jsx(InputText, { value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), placeholder: "Search by address...", className: "p-inputtext-sm", style: { width: '250px' } })] }), _jsx(Button, { label: "Take Token Snapshot", icon: "pi pi-camera", onClick: takeTokenSnapshot, loading: loading, className: "ml-2" })] })] }), _jsxs(DataTable, { value: tokenHolders, loading: loading, paginator: true, rows: 10, dataKey: "address", className: "p-datatable-sm", rowClassName: getRowClassName, sortField: "balance", sortOrder: -1, removableSort: false, children: [_jsx(Column, { field: "address", header: "Address", body: addressTemplate, sortable: true }), _jsx(Column, { field: "balance", header: "Token Balance", body: tokenBalanceTemplate, sortable: true }), _jsx(Column, { header: "Social Info", body: socialInfoTemplate, style: { minWidth: '200px' }, sortable: false }), _jsx(Column, { body: socialActionsTemplate, style: { width: '5em' }, header: "Actions" })] })] }), _jsxs(TabPanel, { header: "Social Profiles", children: [_jsx("div", { className: "flex justify-between items-center mb-4", children: _jsx("h1", { className: "text-2xl font-bold", children: "Social Profiles" }) }), _jsxs(DataTable, { value: socialHolders, loading: loading, paginator: true, rows: 10, dataKey: "address", className: "p-datatable-sm", rowClassName: getRowClassName, children: [_jsx(Column, { field: "address", header: "Wallet Address", body: addressTemplate, sortable: true }), _jsx(Column, { field: "socialProfiles.twitter", header: "Twitter", body: twitterTemplate, sortable: true }), _jsx(Column, { field: "socialProfiles.discord", header: "Discord", body: discordTemplate, sortable: true }), _jsx(Column, { field: "socialProfiles.comment", header: "Comment", sortable: true }), _jsx(Column, { field: "tokenBalance", header: "Token Balance", body: (rowData) => formatTokenBalance(rowData.tokenBalance), sortable: true }), _jsx(Column, { field: "gen1Count", header: "Gen1 Count", sortable: true }), _jsx(Column, { field: "infantCount", header: "Infant Count", sortable: true }), _jsx(Column, { field: "nftCount", header: "Total NFTs", sortable: true }), _jsx(Column, { body: socialActionsTemplate, style: { width: '5em' }, header: "Actions" })] })] })] }), _jsx(Dialog, { header: "Edit Social Profiles", visible: socialDialogVisible, style: { width: '450px' }, onHide: () => setSocialDialogVisible(false), footer: _jsxs(_Fragment, { children: [_jsx(Button, { label: "Cancel", icon: "pi pi-times", onClick: () => setSocialDialogVisible(false), className: "p-button-text" }), _jsx(Button, { label: "Save", icon: "pi pi-check", onClick: saveSocialProfile, loading: loading })] }), children: _jsxs("div", { className: "p-fluid", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "twitter", children: "Twitter Handle" }), _jsxs("div", { className: "p-inputgroup", children: [_jsx("span", { className: "p-inputgroup-addon", children: "@" }), _jsx(InputText, { id: "twitter", value: twitterHandle, onChange: (e) => setTwitterHandle(e.target.value), placeholder: "username" })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "discord", children: "Discord Handle" }), _jsx(InputText, { id: "discord", value: discordHandle, onChange: (e) => setDiscordHandle(e.target.value), placeholder: "username#1234" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "comment", children: "Comment" }), _jsx(InputText, { id: "comment", value: comment, onChange: (e) => setComment(e.target.value), placeholder: "Add notes about this holder..." })] })] }) })] }));
};
export default App;
