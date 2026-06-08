import { useMemo } from 'react';
import { AUTH_BRAND_NAME, AUTH_PRIMARY, AUTH_THEME, AuthLayout } from '@/constants/authTheme';
import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';

export function useAuthScreenTheme() {
  return useMemo(
    () => ({
      brandName: AUTH_BRAND_NAME,
      colors: {
        primary: AUTH_THEME.primary,
        headerBrand: AUTH_PRIMARY,
        primaryLight: AUTH_THEME.primaryLight,
        primarySoft: AUTH_THEME.primarySoft,
        primaryMuted: AUTH_THEME.primaryMuted,
        pageBg: AUTH_THEME.pageBg,
        surface: Colors.white,
        background: AUTH_THEME.pageBg,
        inputBg: Colors.white,
        headerBg: AUTH_THEME.headerBg,
        headerBorder: AUTH_THEME.headerBorder,
        mutedText: Colors.textSecondary,
        tabTrack: '#F3F4F6',
        tabActiveBg: AUTH_THEME.primary,
        inputBorder: AUTH_THEME.primaryMuted,
        inputBorderError: '#B91C1C',
        inputFocus: AUTH_THEME.primary,
        disabledButton: AUTH_THEME.disabledButton,
        legalLink: AUTH_THEME.legalLink,
        placeholder: Colors.textSecondary,
        resendText: Colors.secondary,
        countrySelectedBg: AUTH_THEME.primaryLight,
        tabInactiveText: Colors.text,
        textPrimary: Colors.text,
        onPrimary: Colors.white,
        checkboxBorder: AUTH_THEME.checkboxBorder,
      },
      layout: AuthLayout,
      radius: Theme.borderRadius,
      spacing: Theme.spacing,
      typography: {
        fontSize: {
          sm: 12,
          md: 14,
          lg: 16,
          xl: 18,
          '2xl': 20,
          '3xl': 24,
        },
        fontWeight: {
          regular: '400' as const,
          semibold: '600' as const,
          bold: '700' as const,
        },
        letterSpacing: {
          normal: 0,
        },
      },
    }),
    []
  );
}

export type AuthScreenTheme = ReturnType<typeof useAuthScreenTheme>;
