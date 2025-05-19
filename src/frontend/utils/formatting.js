/**
 * Format a number with commas and optional decimal places
 * @param {number} value - The number to format
 * @param {number} [decimalPlaces=2] - Number of decimal places to include
 * @returns {string} - Formatted number as string
 */
export const formatNumber = (value, decimalPlaces = 2) => {
  if (value === undefined || value === null) return '';
  
  // Format with commas and fixed decimal places
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
};

/**
 * Format a date as a relative time string (e.g., "2 hours ago")
 * @param {Date|string} date - The date to format
 * @returns {string} - Formatted relative time
 */
export const formatRelativeTime = (date) => {
  if (!date) return '';
  
  const now = new Date();
  const inputDate = date instanceof Date ? date : new Date(date);
  const diffMs = now.getTime() - inputDate.getTime();
  
  // Convert difference to appropriate units
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 30) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else {
    // If older than a month, just return the date
    return inputDate.toLocaleDateString();
  }
};

/**
 * Format a percentage
 * @param {number} value - The percentage value (e.g., 0.12 for 12%)
 * @param {boolean} [includeSign=true] - Whether to include + sign for positive values
 * @returns {string} - Formatted percentage string
 */
export const formatPercentage = (value, includeSign = true) => {
  if (value === undefined || value === null) return '';
  
  const percentValue = value * 100;
  const sign = includeSign && percentValue > 0 ? '+' : '';
  
  return `${sign}${percentValue.toFixed(2)}%`;
};

/**
 * Format a date in a specified format
 * @param {Date|string} date - The date to format
 * @param {string} [format='medium'] - Date format ('short', 'medium', 'long')
 * @returns {string} - Formatted date string
 */
export const formatDate = (date, format = 'medium') => {
  if (!date) return '';
  
  const inputDate = date instanceof Date ? date : new Date(date);
  
  const options = {
    short: { month: 'numeric', day: 'numeric', year: '2-digit' },
    medium: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }
  };
  
  return inputDate.toLocaleDateString(undefined, options[format]);
}; 