/**
 * Native Feature Detection Utility
 * Detects availability of native modules and Expo Go vs development/production builds
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Check if running in Expo Go
 * Expo Go has limited native module support
 */
export const isExpoGo = (): boolean => {
  try {
    // Constants.appOwnership is 'expo' in Expo Go, 'standalone' in production, 'guest' in development builds
    return Constants.appOwnership === 'expo';
  } catch {
    // Fallback: if Constants is not available, assume we're in Expo Go
    return true;
  }
};

/**
 * Check if running in development build (not Expo Go)
 */
export const isDevelopmentBuild = (): boolean => {
  try {
    return (Constants.appOwnership as string) === 'standalone' || (Constants.appOwnership as string) === 'guest';
  } catch {
    return false;
  }
};

/**
 * Check if AsyncStorage is available
 */
export const isAsyncStorageAvailable = (): boolean => {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return AsyncStorage !== null && AsyncStorage !== undefined;
  } catch {
    return false;
  }
};

/**
 * Check if expo-av video player is available
 * NOTE: This only checks if the module can be loaded, not if hooks can be used
 */
export const isVideoPlayerAvailable = (): boolean => {
  try {
    const expoAv = require('expo-av');
    return expoAv !== null && expoAv !== undefined;
  } catch {
    return false;
  }
};

/**
 * Check if expo-secure-store is available
 */
export const isSecureStoreAvailable = (): boolean => {
  try {
    const SecureStore = require('expo-secure-store');
    return SecureStore !== null && SecureStore !== undefined;
  } catch {
    return false;
  }
};

/**
 * Check if expo-location is available
 */
export const isLocationAvailable = (): boolean => {
  try {
    const Location = require('expo-location');
    return Location !== null && Location !== undefined;
  } catch {
    return false;
  }
};

/**
 * Check if react-native-maps is available
 */
export const isMapsAvailable = (): boolean => {
  try {
    const Maps = require('react-native-maps');
    return Maps !== null && Maps !== undefined;
  } catch {
    return false;
  }
};

/**
 * Feature flags for native modules
 */
export const NativeFeatures = {
  // Storage
  asyncStorage: {
    available: isAsyncStorageAvailable(),
    preferred: !isExpoGo() && isAsyncStorageAvailable(), // Prefer in dev/prod builds
    fallback: isExpoGo() || !isAsyncStorageAvailable(), // Use fallback in Expo Go
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
    platform: Platform.OS,
  },
} as const;

/**
 * Get feature availability summary
 */
export const getFeatureSummary = () => {
  return {
    environment: NativeFeatures.environment,
    storage: {
      asyncStorage: NativeFeatures.asyncStorage.available,
      secureStore: NativeFeatures.secureStore.available,
    },
    media: {
      videoPlayer: NativeFeatures.videoPlayer.available,
    },
    location: {
      location: NativeFeatures.location.available,
      maps: NativeFeatures.maps.available,
    },
  };
};

