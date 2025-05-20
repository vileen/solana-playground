import React from 'react';

import { InputText } from 'primereact/inputtext';
import { useAppNavigation } from '../hooks/useAppNavigation.js';

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchTerm,
  onSearchChange,
  placeholder = 'Search by wallet, Twitter, Discord...',
}) => {
  const appNavigation = useAppNavigation();
  
  const handleSearchChange = (value: string) => {
    // Update URL directly with the new search term
    appNavigation.updateSearchParam(value);
    
    // Also call the parent's onSearchChange to keep component state in sync
    onSearchChange(value);
  };

  return (
    <span className="p-input-icon-left">
      <i className="pi pi-search" />
      <InputText
        value={searchTerm}
        onChange={e => handleSearchChange(e.target.value)}
        placeholder={placeholder}
      />
    </span>
  );
};

export default SearchBar;
