import { NativeModules, Platform } from 'react-native';
import { logger } from './logger';

/**
 * Check if a native module is available
 * In Expo Development Client, some modules may not be available
 */
export const isNativeModuleAvailable = (moduleName: string): boolean => {
  try {
    const module = NativeModules[moduleName];
    return module !== undefined && module !== null;
  } catch (error) {
    logger.warn(`Native module ${moduleName} check failed:`, error);
    return false;
  }
};

/**
 * Get list of missing native modules
 * Useful for debugging development client issues
 */
export const getMissingNativeModules = (): string[] => {
  // Note: In modern Expo SDK 54+, many modules are auto-linked and may not appear
  // in NativeModules directly. This check is mainly for debugging purposes.
  const commonModules = [
    'RNNetInfo',          // @react-native-community/netinfo
    'RNCAsyncStorage',    // @react-native-async-storage/async-storage
  ];

  return commonModules.filter((mod) => !isNativeModuleAvailable(mod));
};

/**
 * Check if we're in development mode with Expo Development Client
 */
export const isExpoDevClient = (): boolean => {
  try {
    // In Expo dev client, the app will have __DEV__ true and running under EAS/Expo
    return Boolean(__DEV__ && typeof global.__DEV__ !== 'undefined');
  } catch {
    return false;
  }
};

/**
 * Log available and missing native modules (for debugging)
 */
export const logNativeModuleStatus = (): void => {
  const missing = getMissingNativeModules();
  if (missing.length > 0) {
    logger.warn('Some native modules may not be available:', missing);
    logger.info('This is normal in Expo SDK 54+ with auto-linking. Modules may still work correctly.');
  }
  
  // Log available native modules for debugging (only in development)
  if (__DEV__) {
    const availableModules = Object.keys(NativeModules);
    logger.info(`Found ${availableModules.length} native modules`);
    // Only log specific modules if there are issues
    if (missing.length > 0) {
      logger.debug('Available native modules:', availableModules.sort());
    }
  }
};
