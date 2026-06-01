/**
 * Validation Constants
 * Validation rules and constraints
 */

export const VALIDATION_RULES = {
  // Phone number
  PHONE_MIN_LENGTH: 10,
  PHONE_MAX_LENGTH: 12,
  PHONE_PATTERN: /^(\+91|91)?[6-9]\d{9}$/,
  
  // OTP
  OTP_LENGTH: 6,
  OTP_PATTERN: /^\d{6}$/,
  
  // Email
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  EMAIL_MAX_LENGTH: 255,
  
  // Password
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  PASSWORD_REQUIRE_UPPERCASE: true,
  PASSWORD_REQUIRE_LOWERCASE: true,
  PASSWORD_REQUIRE_NUMBER: true,
  PASSWORD_REQUIRE_SPECIAL: true,
  
  // Name
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  NAME_PATTERN: /^[a-zA-Z\s]+$/,
  
  // Address
  ADDRESS_MIN_LENGTH: 10,
  ADDRESS_MAX_LENGTH: 200,
  
  // PIN code (Indian)
  PINCODE_LENGTH: 6,
  PINCODE_PATTERN: /^\d{6}$/,
  
  // City/State
  CITY_MIN_LENGTH: 2,
  CITY_MAX_LENGTH: 50,
  STATE_MIN_LENGTH: 2,
  STATE_MAX_LENGTH: 50,
  
  // Quantity
  QUANTITY_MIN: 1,
  QUANTITY_MAX: 99,
} as const;

export const VALIDATION_MESSAGES = {
  REQUIRED: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PHONE: 'Please enter a valid phone number',
  INVALID_OTP: 'Please enter a valid 6-digit OTP',
  INVALID_PINCODE: 'Please enter a valid 6-digit PIN code',
  PASSWORD_TOO_SHORT: `Password must be at least ${VALIDATION_RULES.PASSWORD_MIN_LENGTH} characters`,
  PASSWORD_TOO_LONG: `Password must be less than ${VALIDATION_RULES.PASSWORD_MAX_LENGTH} characters`,
  PASSWORD_REQUIRE_UPPERCASE: 'Password must contain at least one uppercase letter',
  PASSWORD_REQUIRE_LOWERCASE: 'Password must contain at least one lowercase letter',
  PASSWORD_REQUIRE_NUMBER: 'Password must contain at least one number',
  PASSWORD_REQUIRE_SPECIAL: 'Password must contain at least one special character',
  NAME_TOO_SHORT: `Name must be at least ${VALIDATION_RULES.NAME_MIN_LENGTH} characters`,
  NAME_TOO_LONG: `Name must be less than ${VALIDATION_RULES.NAME_MAX_LENGTH} characters`,
  ADDRESS_TOO_SHORT: `Address must be at least ${VALIDATION_RULES.ADDRESS_MIN_LENGTH} characters`,
  ADDRESS_TOO_LONG: `Address must be less than ${VALIDATION_RULES.ADDRESS_MAX_LENGTH} characters`,
  QUANTITY_INVALID: `Quantity must be between ${VALIDATION_RULES.QUANTITY_MIN} and ${VALIDATION_RULES.QUANTITY_MAX}`,
} as const;

