/**
 * Expo Go Detection Utility
 * Provides utilities to detect if the app is running in Expo Go vs development/production builds
 * and check native module availability
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * App ownership types from Expo Constants
 */
type AppOwnership = 'expo' | 'standalone' | 'guest';

/**
 * Check if running in Expo Go
 * Expo Go has limited native module support
 */
export const isExpoGo = (): boolean => {
  try {
    // Constants.appOwnership is 'expo' in Expo Go
    // 'standalone' in production builds
    // 'guest' in development builds
    return Constants.appOwnership === 'expo';
  } catch (error) {
    // Fallback: if Constants is not available, assume we're in Expo Go
    return true;
  }
};

/**
 * Check if running in a development build (not Expo Go)
 * Development builds have full native module support
 */
export const isDevelopmentBuild = (): boolean => {
  try {
    return (Constants.appOwnership as string) === 'standalone' || (Constants.appOwnership as string) === 'guest';
  } catch (error) {
    return false;
  }
};

/**
 * Check if running in a production build
 */
export const isProductionBuild = (): boolean => {
  try {
    return (Constants.appOwnership as string) === 'standalone';
  } catch (error) {
    return false;
  }
};

/**
 * Get the current app ownership type
 */
export const getAppOwnership = (): AppOwnership | null => {
  try {
    return Constants.appOwnership as AppOwnership;
  } catch (error) {
    return null;
  }
};

/**
 * Check if a native module is available
 * @param moduleName - Name of the module to check (e.g., 'expo-av', '@react-native-async-storage/async-storage')
 */
export const isNativeModuleAvailable = (moduleName: string): boolean => {
  try {
    const module = require(moduleName);
    return module !== null && module !== undefined;
  } catch (error) {
    return false;
  }
};

/**
 * Check if expo-av video player is available
 */
export const isVideoPlayerAvailable = (): boolean => {
  if (isExpoGo()) {
    return false; // Video player is not fully supported in Expo Go
  }
  return isNativeModuleAvailable('expo-av');
};

/**
 * Check if AsyncStorage is available
 */
export const isAsyncStorageAvailable = (): boolean => {
  if (isExpoGo()) {
    return false; // AsyncStorage requires native module
  }
  return isNativeModuleAvailable('@react-native-async-storage/async-storage');
};

/**
 * Check if expo-secure-store is available
 */
export const isSecureStoreAvailable = (): boolean => {
  if (isExpoGo()) {
    return false; // SecureStore requires native module
  }
  return isNativeModuleAvailable('expo-secure-store');
};

/**
 * Check if expo-location is available
 */
export const isLocationAvailable = (): boolean => {
  // Location generally works in Expo Go, but permissions are native
  return isNativeModuleAvailable('expo-location');
};

/**
 * Check if react-native-maps is available
 */
export const isMapsAvailable = (): boolean => {
  if (isExpoGo()) {
    return false; // Maps requires native setup
  }
  return isNativeModuleAvailable('react-native-maps');
};

/**
 * Get environment information
 */
export const getEnvironmentInfo = () => {
  return {
    isExpoGo: isExpoGo(),
    isDevelopmentBuild: isDevelopmentBuild(),
    isProductionBuild: isProductionBuild(),
    appOwnership: getAppOwnership(),
    platform: Platform.OS,
    platformVersion: Platform.Version,
    expoVersion: Constants.expoVersion,
    installationId: Constants.installationId,
  };
};

/**
 * Feature availability flags
 * Use these to conditionally enable/disable features based on environment
 */
export const FeatureFlags = {
  // Storage
  asyncStorage: {
    available: isAsyncStorageAvailable(),
    preferred: !isExpoGo() && isAsyncStorageAvailable(),
    fallback: isExpoGo() || !isAsyncStorageAvailable(),
  },
  
  // Secure Storage
  secureStore: {
    available: isSecureStoreAvailable(),
    preferred: !isExpoGo() && isSecureStoreAvailable(),
    fallback: isExpoGo() || !isSecureStoreAvailable(),
  },
  
  // Video Player
  videoPlayer: {
    available: isVideoPlayerAvailable(),
    preferred: !isExpoGo() && isVideoPlayerAvailable(),
    fallback: isExpoGo() || !isVideoPlayerAvailable(),
  },
  
  // Location Services
  location: {
    available: isLocationAvailable(),
    preferred: !isExpoGo() && isLocationAvailable(),
    fallback: isExpoGo() || !isLocationAvailable(),
  },
  
  // Maps
  maps: {
    available: isMapsAvailable(),
    preferred: !isExpoGo() && isMapsAvailable(),
    fallback: isExpoGo() || !isMapsAvailable(),
  },
  
  // Environment
  environment: {
    isExpoGo: isExpoGo(),
    isDevelopmentBuild: isDevelopmentBuild(),
    isProductionBuild: isProductionBuild(),
    platform: Platform.OS,
    appOwnership: getAppOwnership(),
  },
} as const;

/**
 * Get a summary of all feature availability
 */
export const getFeatureSummary = () => {
  return {
    environment: FeatureFlags.environment,
    storage: {
      asyncStorage: FeatureFlags.asyncStorage.available,
      secureStore: FeatureFlags.secureStore.available,
    },
    media: {
      videoPlayer: FeatureFlags.videoPlayer.available,
    },
    location: {
      location: FeatureFlags.location.available,
      maps: FeatureFlags.maps.available,
    },
  };
};

/**
 * Log environment and feature availability (useful for debugging)
 */
export const logEnvironmentInfo = () => {
  if (__DEV__) {
    console.log('=== Expo Go Detection ===');
    console.log('Environment:', getEnvironmentInfo());
    console.log('Feature Flags:', FeatureFlags);
    console.log('Feature Summary:', getFeatureSummary());
  }
};

// Export default object for convenience
export default {
  isExpoGo,
  isDevelopmentBuild,
  isProductionBuild,
  getAppOwnership,
  isNativeModuleAvailable,
  isVideoPlayerAvailable,
  isAsyncStorageAvailable,
  isSecureStoreAvailable,
  isLocationAvailable,
  isMapsAvailable,
  getEnvironmentInfo,
  FeatureFlags,
  getFeatureSummary,
  logEnvironmentInfo,
};

