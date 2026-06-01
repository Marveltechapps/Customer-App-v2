/**
 * Date Helpers Utility
 * Date manipulation and formatting utilities
 */

/**
 * Format date to readable string
 */
export const formatDate = (date: Date | string, format: 'short' | 'long' | 'relative' = 'short'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (format === 'relative') {
    return getRelativeTime(dateObj);
  }
  
  const options: Intl.DateTimeFormatOptions = 
    format === 'long'
      ? { year: 'numeric', month: 'long', day: 'numeric' }
      : { year: 'numeric', month: 'short', day: 'numeric' };
  
  return new Intl.DateTimeFormat('en-IN', options).format(dateObj);
};

/**
 * Format date and time
 */
export const formatDateTime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
};

/**
 * Format time only
 */
export const formatTime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
};

/**
 * Get relative time (e.g., "2 hours ago", "in 3 days")
 */
export const getRelativeTime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
  
  if (Math.abs(diffInSeconds) < 60) {
    return 'just now';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (Math.abs(diffInMinutes) < 60) {
    return diffInMinutes > 0 ? `${diffInMinutes} minutes ago` : `in ${Math.abs(diffInMinutes)} minutes`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (Math.abs(diffInHours) < 24) {
    return diffInHours > 0 ? `${diffInHours} hours ago` : `in ${Math.abs(diffInHours)} hours`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (Math.abs(diffInDays) < 30) {
    return diffInDays > 0 ? `${diffInDays} days ago` : `in ${Math.abs(diffInDays)} days`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (Math.abs(diffInMonths) < 12) {
    return diffInMonths > 0 ? `${diffInMonths} months ago` : `in ${Math.abs(diffInMonths)} months`;
  }
  
  const diffInYears = Math.floor(diffInMonths / 12);
  return diffInYears > 0 ? `${diffInYears} years ago` : `in ${Math.abs(diffInYears)} years`;
};

/**
 * Check if date is today
 */
export const isToday = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return (
    dateObj.getDate() === today.getDate() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getFullYear() === today.getFullYear()
  );
};

/**
 * Check if date is yesterday
 */
export const isYesterday = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    dateObj.getDate() === yesterday.getDate() &&
    dateObj.getMonth() === yesterday.getMonth() &&
    dateObj.getFullYear() === yesterday.getFullYear()
  );
};

/**
 * Get start of day
 */
export const getStartOfDay = (date: Date | string): Date => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const start = new Date(dateObj);
  start.setHours(0, 0, 0, 0);
  return start;
};

/**
 * Get end of day
 */
export const getEndOfDay = (date: Date | string): Date => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const end = new Date(dateObj);
  end.setHours(23, 59, 59, 999);
  return end;
};

/**
 * Add days to date
 */
export const addDays = (date: Date | string, days: number): Date => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const result = new Date(dateObj);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Get difference in days
 */
export const getDaysDifference = (date1: Date | string, date2: Date | string): number => {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

