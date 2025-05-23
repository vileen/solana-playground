import React, { useEffect, useRef, useState } from 'react';

import { InputText } from 'primereact/inputtext';

import { useAppNavigation } from '../hooks/useAppNavigation.js';

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  debounceTime?: number;
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchTerm,
  onSearchChange,
  placeholder = 'Search by wallet, X, Discord...',
  debounceTime = 300, // Default debounce time of 300ms
}) => {
  const appNavigation = useAppNavigation();
  const [inputValue, setInputValue] = useState(searchTerm);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Update internal state when search term prop changes
  useEffect(() => {
    if (searchTerm !== inputValue) {
      setInputValue(searchTerm);
    }
  }, [searchTerm]);

  const handleInputChange = (value: string) => {
    // Update the input field immediately for responsive UI
    setInputValue(value);

    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set a new timer to update the search after debounce period
    debounceTimerRef.current = setTimeout(() => {
      // Only trigger search if value has changed
      if (value !== searchTerm) {
        // Update URL directly with the new search term
        appNavigation.updateSearchParam(value);

        // Also call the parent's onSearchChange to keep component state in sync
        onSearchChange(value);
      }
    }, debounceTime);
  };

  const handleClear = () => {
    // Clear input immediately
    setInputValue('');

    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Update URL and parent state immediately
    appNavigation.updateSearchParam('');
    onSearchChange('');
  };

  // Show clear icon when there's text in the input
  const showClearIcon = inputValue && inputValue.trim() !== '';

  return (
    <span className={`p-input-icon-left ${showClearIcon ? 'p-input-icon-right' : ''}`}>
      <i className="pi pi-search" />
      {showClearIcon && (
        <i
          className="pi pi-times"
          onClick={handleClear}
          style={{
            cursor: 'pointer',
            color: '#6c757d',
            fontSize: '0.875rem',
            right: '0.75rem',
          }}
          title="Clear search"
        />
      )}
      <InputText
        value={inputValue}
        onChange={e => handleInputChange(e.target.value)}
        placeholder={placeholder}
        style={showClearIcon ? { paddingRight: '2.5rem' } : {}}
      />
    </span>
  );
};

export default SearchBar;
