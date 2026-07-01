/** Shared layout + brand constants for login / OTP screens (Selorg Customer green theme). */
import { Colors } from './Colors';

export const AUTH_BRAND_NAME = 'Selorg Customer';

/** Customer auth brand color — header text, tabs, inputs, links. */
export const AUTH_PRIMARY = Colors.primary;

export const AUTH_THEME = {
  primary: AUTH_PRIMARY,
  headerBg: '#E8F0E8',
  headerBorder: '#B8D4BA',
  pageBg: Colors.background,
  primarySoft: '#E8F0E8',
  primaryMuted: '#9BC49E',
  primaryLight: '#D9EAD9',
  legalLink: AUTH_PRIMARY,
  checkboxBorder: '#9CA3AF',
  disabledButton: '#E0E0E0',
} as const;

export const AuthLayout = {
  contentPaddingH: 21,
  headerRadius: 24,
  tabRadius: 16,
  tabPadding: 4,
  otpBoxWidth: 42,
  otpBoxHeight: 56,
  otpGap: 10.5,
  resendCooldownSec: 30,
} as const;
