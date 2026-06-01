/**
 * Responsive Utilities
 * Screen size and responsive design helpers
 */

import React from 'react';
import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Base width for design (e.g., iPhone 14 Pro width)
 */
const BASE_WIDTH = 393;
const BASE_HEIGHT = 852;

/**
 * Scale factor based on screen width
 */
export const scale = (size: number): number => {
  return (SCREEN_WIDTH / BASE_WIDTH) * size;
};

/**
 * Vertical scale factor based on screen height
 */
export const verticalScale = (size: number): number => {
  return (SCREEN_HEIGHT / BASE_HEIGHT) * size;
};

/**
 * Moderate scale - less aggressive scaling
 */
export const moderateScale = (size: number, factor: number = 0.5): number => {
  return size + (scale(size) - size) * factor;
};

/**
 * Get screen dimensions
 */
export const getScreenDimensions = () => ({
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
});

/**
 * Check if device is tablet
 */
export const isTablet = (): boolean => {
  return SCREEN_WIDTH >= 768;
};

/**
 * Check if device is small screen
 */
export const isSmallScreen = (): boolean => {
  return SCREEN_WIDTH < 375;
};

/**
 * Get pixel ratio
 */
export const getPixelRatio = (): number => {
  return PixelRatio.get();
};

/**
 * Alias for getScreenDimensions for backward compatibility
 */
export const getWindowDimensions = getScreenDimensions;

/**
 * Get spacing using scale function (alias for scale)
 */
export const getSpacing = scale;

/**
 * Width percentage helper
 */
export const wp = (percentage: number): number => {
  return (SCREEN_WIDTH * percentage) / 100;
};

/**
 * Height percentage helper
 */
export const hp = (percentage: number): number => {
  return (SCREEN_HEIGHT * percentage) / 100;
};

/**
 * Scale font size
 * @param size - Base font size
 * @param min - Minimum font size (optional)
 * @param max - Maximum font size (optional)
 */
export const scaleFont = (size: number, min?: number, max?: number): number => {
  const scaledSize = scale(size);
  if (min !== undefined && scaledSize < min) {
    return min;
  }
  if (max !== undefined && scaledSize > max) {
    return max;
  }
  return scaledSize;
};

/**
 * Get card width helper
 */
export const getCardWidth = (cardsPerRow: number = 2, gap: number = 12, padding: number = 16): number => {
  const containerPadding = padding * 2;
  const gaps = (cardsPerRow - 1) * gap;
  return (SCREEN_WIDTH - containerPadding - gaps) / cardsPerRow;
};

export type TwoColumnCardWidthOpts = {
  horizontalPadding: number; // total left + right padding in the container
  columnGap: number; // gap between the two columns
  sidebarWidth?: number; // optional fixed sidebar width (e.g. subcategory rail)
};

export const getTwoColumnCardWidth = (screenWidth: number, opts: TwoColumnCardWidthOpts): number => {
  const sidebarWidth = opts.sidebarWidth ?? 0;
  return (screenWidth - sidebarWidth - opts.horizontalPadding - opts.columnGap) / 2;
};

/**
 * Get border radius helper
 */
export const getBorderRadius = (size: number): number => {
  return scale(size);
};

/**
 * Hook to get dimensions
 */
export const useDimensions = () => {
  const [dimensions, setDimensions] = React.useState({
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  });

  React.useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({
        width: window.width,
        height: window.height,
      });
    });

    return () => subscription?.remove();
  }, []);

  return dimensions;
};
