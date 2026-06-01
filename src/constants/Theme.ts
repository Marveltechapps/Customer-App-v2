import { Colors } from './Colors';

export const Theme = {
  colors: Colors,
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    /** Vertical gap between stacked white cards / hero and first card on #F5F5F5 screens (Product Detail, banners, etc.). */
    sectionCardGap: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    round: 9999,
  },
  typography: {
    h1: {
      fontSize: 32,
      fontWeight: '700' as const,
      lineHeight: 40,
      fontFamily: 'Inter',
    },
    h2: {
      fontSize: 24,
      fontWeight: '600' as const,
      lineHeight: 32,
      fontFamily: 'Inter',
    },
    h3: {
      fontSize: 20,
      fontWeight: '600' as const,
      lineHeight: 28, // 1.4em = 28px
      fontFamily: 'Inter',
    },
    body: {
      fontSize: 16,
      fontWeight: '500' as const,
      lineHeight: 24, // 1.5em = 24px
      fontFamily: 'Inter',
    },
    menuItem: {
      fontSize: 14,
      fontWeight: '500' as const,
      lineHeight: 20, // 1.4285714285714286em ≈ 20px
      fontFamily: 'Inter',
    },
    bodySmall: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
      fontFamily: 'Inter',
    },
    caption: {
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 16,
      fontFamily: 'Inter',
    },
  },
};

export default Theme;

