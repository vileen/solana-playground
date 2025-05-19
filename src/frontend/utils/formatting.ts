/**
 * Utility functions for formatting dates, numbers, and other display values
 */

/**
 * Format a date with various options
 * 
 * @param date The date to format (string or Date object)
 * @param format The format to use: 'short', 'medium', 'long', or 'full'
 * @returns Formatted date string
 */
export function formatDate(date: string | Date, format: 'short' | 'medium' | 'long' | 'full' = 'medium'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const options: Intl.DateTimeFormatOptions = { 
    timeZone: 'UTC' 
  };
  
  switch (format) {
    case 'short':
      // May 5, 2023
      options.month = 'short';
      options.day = 'numeric';
      options.year = 'numeric';
      break;
    case 'medium':
      // May 5, 2023, 13:45:30
      options.month = 'short';
      options.day = 'numeric';
      options.year = 'numeric';
      options.hour = '2-digit';
      options.minute = '2-digit';
      break;
    case 'long':
      // May 5, 2023, 13:45:30 UTC
      options.month = 'long';
      options.day = 'numeric';
      options.year = 'numeric';
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.second = '2-digit';
      break;
    case 'full':
      // Friday, May 5, 2023, 13:45:30 UTC
      options.weekday = 'long';
      options.month = 'long';
      options.day = 'numeric';
      options.year = 'numeric';
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.second = '2-digit';
      break;
  }
  
  return new Intl.DateTimeFormat('en-US', options).format(dateObj);
}

/**
 * Format a number with thousands separators and decimal places
 * 
 * @param value The number to format
 * @param decimals Number of decimal places to show
 * @returns Formatted number string
 */
export function formatNumber(value: number, decimals = 2): string {
  if (value === undefined || value === null) return '';
  
  // Handle very large numbers
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(2)}B`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(2)}M`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K`;
  }
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: value % 1 === 0 ? 0 : decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

/**
 * Format a time relative to now (e.g., "5 minutes ago")
 * 
 * @param date The date to format relative to now
 * @returns Relative time string
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  
  // Time difference in seconds
  const diffSeconds = Math.floor((now.getTime() - targetDate.getTime()) / 1000);
  
  // Return "Just now" for very recent updates
  if (diffSeconds < 60) {
    return 'Just now';
  }
  
  // Time units with their respective seconds
  const units: [string, number][] = [
    ['year', 31536000],   // 365 * 24 * 60 * 60
    ['month', 2592000],   // 30 * 24 * 60 * 60
    ['week', 604800],     // 7 * 24 * 60 * 60
    ['day', 86400],       // 24 * 60 * 60
    ['hour', 3600],       // 60 * 60
    ['minute', 60],
    ['second', 1]
  ];
  
  // Find the appropriate time unit
  for (const [unit, secondsInUnit] of units) {
    const count = Math.floor(diffSeconds / secondsInUnit);
    
    if (count > 0) {
      return `${count} ${unit}${count > 1 ? 's' : ''} ago`;
    }
  }
  
  return 'Just now';
} 