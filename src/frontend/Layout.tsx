import React, { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';

import { Button } from 'primereact/button';

import { getSavedTheme, loadThemeCSS, toggleTheme } from './utils/theme.js';

const Layout: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    // Load saved theme preference
    const savedIsDarkMode = getSavedTheme();
    setIsDarkMode(savedIsDarkMode);
    loadThemeCSS(savedIsDarkMode);
  }, []);

  const handleThemeToggle = () => {
    setIsDarkMode(toggleTheme(isDarkMode));
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="flex align-items-center">
          <h1>Solana NFT Snapshot Tool</h1>
          <div className="ml-4 flex">
            <Link to="/" className="p-button p-button-text mr-2">
              Tabbed View
            </Link>
            <Link to="/dashboard" className="p-button p-button-text">
              Dashboard
            </Link>
          </div>
        </div>
        <div className="header-actions">
          <Button
            icon={isDarkMode ? 'pi pi-sun' : 'pi pi-moon'}
            className="p-button-rounded p-button-text"
            onClick={handleThemeToggle}
            tooltip={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          />
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout; 