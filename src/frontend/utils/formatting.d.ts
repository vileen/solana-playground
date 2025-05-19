declare module '../utils/formatting.js' {
  export function formatNumber(value: number, decimalPlaces?: number): string;
  export function formatRelativeTime(date: Date | string): string;
  export function formatPercentage(value: number, includeSign?: boolean): string;
  export function formatDate(date: Date | string, format?: 'short' | 'medium' | 'long'): string;
} 