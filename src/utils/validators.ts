/**
 * Validators Utility
 * Email, phone, form validators
 */

/**
 * Validate email address
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (Indian format)
 */
export const isValidPhoneNumber = (phone: string): boolean => {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Indian phone numbers: 10 digits or 12 digits starting with 91
  return cleaned.length === 10 || (cleaned.length === 12 && cleaned.startsWith('91'));
};

/**
 * Validate OTP (6 digits)
 */
export const isValidOTP = (otp: string): boolean => {
  return /^\d{6}$/.test(otp);
};

/**
 * Validate PIN code (Indian format - 6 digits)
 */
export const isValidPincode = (pincode: string): boolean => {
  return /^\d{6}$/.test(pincode);
};

/**
 * Validate required field
 */
export const isRequired = (value: string | number | null | undefined): boolean => {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
};

/**
 * Validate minimum length
 */
export const minLength = (value: string, min: number): boolean => {
  return value.length >= min;
};

/**
 * Validate maximum length
 */
export const maxLength = (value: string, max: number): boolean => {
  return value.length <= max;
};

/**
 * Validate password strength
 */
export const isValidPassword = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validate URL
 */
export const isValidURL = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate numeric value
 */
export const isNumeric = (value: string | number): boolean => {
  return !isNaN(Number(value));
};

/**
 * Validate positive number
 */
export const isPositiveNumber = (value: number): boolean => {
  return value > 0;
};

