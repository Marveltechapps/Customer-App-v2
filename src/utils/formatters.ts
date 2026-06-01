/**
 * Formatters Utility
 * Date, currency, number formatters
 */

/**
 * Format currency amount
 */
export const formatCurrency = (amount: number, currency: string = 'INR', locale: string = 'en-IN'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format number with thousand separators
 */
export const formatNumber = (value: number, locale: string = 'en-IN'): string => {
  return new Intl.NumberFormat(locale).format(value);
};

/**
 * Format percentage
 */
export const formatPercentage = (value: number, decimals: number = 0): string => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format file size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Format phone number
 */
export const formatPhoneNumber = (phone: string): string => {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Format as +91 XXXX XXXXXX for Indian numbers
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  
  return phone;
};

/**
 * Format discount percentage
 */
export const formatDiscount = (originalPrice: number, discountedPrice: number): string => {
  if (originalPrice <= discountedPrice) return '0%';
  const discount = ((originalPrice - discountedPrice) / originalPrice) * 100;
  return `${Math.round(discount)}% OFF`;
};

