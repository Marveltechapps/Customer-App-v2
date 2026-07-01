/** Shared layout + brand constants for login / OTP screens (Selorg Customer brand theme). */
import { Colors } from './Colors';

export const AUTH_BRAND_NAME = 'Selorg Customer';

/** Customer auth brand color — header text, tabs, inputs, links. */
export const AUTH_PRIMARY = Colors.primary;

export const AUTH_THEME = {
  primary: AUTH_PRIMARY,
  headerBg: '#FEF9B8',
  headerBorder: '#E8D447',
  pageBg: Colors.background,
  primarySoft: '#FEF9B8',
  primaryMuted: '#D8C536',
  primaryLight: '#FBF28A',
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
