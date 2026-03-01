import React, { useState } from 'react';

import solscanLogo from '../assets/solscan_logo.png';

interface WalletAddressProps {
  address: string;
  shortened?: boolean;
  showExternalLink?: boolean;
  showCopyIcon?: boolean;
  linkText?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  startLength?: number;
  endLength?: number;
}

const WalletAddress: React.FC<WalletAddressProps> = ({
  address,
  shortened = false,
  showExternalLink = false,
  showCopyIcon = false,
  linkText,
  className = '',
  style,
  onClick,
  startLength = 8,
  endLength = 8,
}) => {
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Format the address based on the shortened prop
  const formatAddress = (addr: string, isShortened: boolean): string => {
    if (!isShortened || addr.length <= startLength + endLength) {
      return addr;
    }
    return `${addr.substring(0, startLength)}...${addr.substring(addr.length - endLength)}`;
  };

  const displayAddress = formatAddress(address, shortened);
  const title = shortened ? address : undefined; // Show full address on hover if shortened

  // Copy address to clipboard
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      await navigator.clipboard.writeText(address);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = address;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  // Render the address content with appropriate wrapper
  const renderAddressContent = () => {
    if (onClick) {
      return (
        <span
          className="wallet-address clickable"
          style={{ cursor: 'pointer' }}
          onClick={onClick}
          title={title}
        >
          {displayAddress}
        </span>
      );
    }

    if (showExternalLink) {
      return (
        <a
          href={`https://solscan.io/account/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="wallet-link flex align-items-center gap-1"
          title={title || 'View on Solscan'}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          {linkText || displayAddress}
          <img
            src={solscanLogo}
            alt="Solscan"
            width="16"
            height="16"
            style={{ opacity: 0.7, verticalAlign: 'middle' }}
          />
        </a>
      );
    }

    return (
      <span className="wallet-address" title={title}>
        {displayAddress}
      </span>
    );
  };

  // If we need icons or it's a complex layout, wrap in a container
  if (showExternalLink || showCopyIcon) {
    return (
      <div className={`flex align-items-center gap-1 ${className}`} style={style}>
        {renderAddressContent()}
        {showCopyIcon && (
          <i
            className={`pi ${copyFeedback ? 'pi-check' : 'pi-copy'} cursor-pointer`}
            style={{
              fontSize: '14px',
              opacity: 0.7,
              color: copyFeedback ? '#22c55e' : 'inherit',
            }}
            onClick={handleCopy}
            title={copyFeedback ? 'Copied!' : 'Copy address'}
          />
        )}
      </div>
    );
  }

  // Simple display without icons
  return (
    <div className={className} style={style}>
      {renderAddressContent()}
    </div>
  );
};

export default WalletAddress;
