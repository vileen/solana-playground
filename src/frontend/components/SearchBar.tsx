import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { InputText } from 'primereact/inputtext';

interface SearchBarProps {
  placeholder?: string;
  debounceTime?: number;
}

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search by wallet, X, Discord...',
  debounceTime = 300,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearchTerm = searchParams.get('search') || '';
  const [inputValue, setInputValue] = useState(urlSearchTerm);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync input with URL when URL changes externally (e.g. back/forward, cross-tab navigation)
  useEffect(() => {
    setInputValue(urlSearchTerm);
  }, [urlSearchTerm]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const updateUrl = (value: string) => {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        if (value) {
          next.set('search', value);
        } else {
          next.delete('search');
        }
        return next;
      },
      { replace: true }
    );
  };

  const handleInputChange = (value: string) => {
    // Update input immediately for responsive UI
    setInputValue(value);

    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce URL update
    debounceTimerRef.current = setTimeout(() => {
      updateUrl(value);
    }, debounceTime);
  };

  const handleClear = () => {
    setInputValue('');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    updateUrl('');
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
