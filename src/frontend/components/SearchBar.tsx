import React from 'react';

import { InputText } from 'primereact/inputtext';

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
  return (
    <span className="p-input-icon-left">
      <i className="pi pi-search" />
      <InputText
        value={searchTerm}
        onChange={e => onSearchChange(e.target.value)}
        placeholder={placeholder}
      />
    </span>
  );
};

export default SearchBar;
