export function stripDigits(value: string): string {
  return (value ?? '').replace(/\D/g, '');
}

export function isAllSameDigit(digits: string): boolean {
  return digits.length > 0 && /^(\d)\1+$/.test(digits);
}

export function getPlaceholder(countryCode: string): string {
  if (countryCode === 'IN') return '98765 43210';
  return '0000000000';
}

export function formatNationalAsYouType(digits: string, countryCode: string): string {
  const d = stripDigits(digits);
  if (!d) return '';
  if (countryCode === 'IN' && d.length <= 10) {
    if (d.length <= 5) return d;
    return `${d.slice(0, 5)} ${d.slice(5)}`;
  }
  return d;
}

export function getMinNationalLength(countryCode: string): number {
  return countryCode === 'IN' ? 10 : 6;
}

export function getMaxNationalLength(countryCode: string): number {
  return countryCode === 'IN' ? 10 : 15;
}

export interface PhoneValidationResult {
  valid: boolean;
  message?: string;
  showInvalid: boolean;
}

function isValidIndianMobile(digits: string): boolean {
  return digits.length === 10 && /^[5-9]/.test(digits);
}

export function validatePhone(
  nationalDigits: string,
  countryCode: string,
  modeLabel: 'mobile' | 'whatsapp' = 'mobile'
): PhoneValidationResult {
  const digits = stripDigits(nationalDigits);
  const minLen = getMinNationalLength(countryCode);
  const emptyLabel = modeLabel === 'whatsapp' ? 'Enter WhatsApp number' : 'Enter mobile number';

  if (!digits) {
    return { valid: false, message: emptyLabel, showInvalid: false };
  }

  const showInvalid = digits.length >= minLen;

  if (isAllSameDigit(digits)) {
    return { valid: false, message: 'Invalid number format', showInvalid };
  }

  if (countryCode === 'IN') {
    if (isValidIndianMobile(digits)) {
      return { valid: true, showInvalid: false };
    }
    if (showInvalid) {
      return { valid: false, message: 'Enter a valid 10-digit mobile number', showInvalid: true };
    }
    return { valid: false, showInvalid: false };
  }

  if (digits.length >= minLen) {
    return { valid: true, showInvalid: false };
  }

  return { valid: false, showInvalid: false };
}

export function truncatePhoneForCountry(digits: string, countryCode: string): string {
  return stripDigits(digits).slice(0, getMaxNationalLength(countryCode));
}
