/**
 * Storage Utility
 * Tokens: SecureStore when available (production), else AsyncStorage, else in-memory (Expo Go).
 * User data and onboarding: AsyncStorage or in-memory.
 */

import { logger } from '@/utils/logger';
import { NativeFeatures } from '@/utils/nativeFeatures';

const memoryStorage: { [key: string]: string } = {};

let AsyncStorage: any = null;
let asyncStorageAvailable = false;
let SecureStore: any = null;
let secureStoreAvailable = false;

if (NativeFeatures.secureStore.available) {
  try {
    SecureStore = require('expo-secure-store');
    secureStoreAvailable = true;
  } catch (error) {
    logger.warn('SecureStore not available', error);
  }
}

if (NativeFeatures.asyncStorage.available || !secureStoreAvailable) {
  try {
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
    asyncStorageAvailable = true;
  } catch (error) {
    if (!NativeFeatures.environment.isExpoGo) {
      logger.warn('AsyncStorage not available', error);
    }
  }
}

// Fallback storage functions for Expo Go
const getItemFallback = async (key: string): Promise<string | null> => {
  return memoryStorage[key] || null;
};

const setItemFallback = async (key: string, value: string): Promise<void> => {
  memoryStorage[key] = value;
};

const removeItemFallback = async (key: string): Promise<void> => {
  delete memoryStorage[key];
};

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_DATA_KEY = 'user_data';
const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';
const ONBOARDING_COMPLETED_AT_KEY = 'onboarding_completed_at';

/**
 * Transient pending-payment marker written during checkout. Tied to the active
 * session, so it must be cleared on logout to stay user-specific.
 */
export const IN_FLIGHT_PAYMENT_KEY = '@selorg_in_flight_payment';

/**
 * Get a user-specific storage key by appending the user's primary identifier.
 * Used to isolate data between accounts on the same device.
 */
export const namespacedKey = (baseKey: string, userKey: string) => `${baseKey}:${userKey}`;

/**
 * Remove any pending in-flight payment marker. Called on logout so a new user
 * never resumes a previous account's payment.
 */
export const clearInFlightPayment = async (userKey?: string): Promise<void> => {
  try {
    const key = userKey ? namespacedKey(IN_FLIGHT_PAYMENT_KEY, userKey) : IN_FLIGHT_PAYMENT_KEY;
    if (asyncStorageAvailable && AsyncStorage) {
      await AsyncStorage.removeItem(key);
      return;
    }
    await removeItemFallback(key);
  } catch (error) {
    logger.error('Error clearing in-flight payment', error);
  }
};

/**
 * Get access token from storage (SecureStore > AsyncStorage > memory)
 */
export const getToken = async (): Promise<string | null> => {
  try {
    if (secureStoreAvailable && SecureStore) {
      return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    }
    if (asyncStorageAvailable && AsyncStorage) {
      return await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
    }
    return await getItemFallback(ACCESS_TOKEN_KEY);
  } catch (error) {
    logger.error('Error getting token', error);
    return await getItemFallback(ACCESS_TOKEN_KEY);
  }
};

/**
 * Save access token to storage
 */
export const saveToken = async (token: string): Promise<boolean> => {
  try {
    if (secureStoreAvailable && SecureStore) {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
      return true;
    }
    if (asyncStorageAvailable && AsyncStorage) {
      await AsyncStorage.setItem(ACCESS_TOKEN_KEY, token);
      return true;
    }
    await setItemFallback(ACCESS_TOKEN_KEY, token);
    return true;
  } catch (error) {
    logger.error('Error saving token', error);
    try {
      await setItemFallback(ACCESS_TOKEN_KEY, token);
      return true;
    } catch {
      return false;
    }
  }
};

/**
 * Get refresh token from storage
 */
export const getRefreshToken = async (): Promise<string | null> => {
  try {
    if (secureStoreAvailable && SecureStore) {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    }
    if (asyncStorageAvailable && AsyncStorage) {
      return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    }
    return await getItemFallback(REFRESH_TOKEN_KEY);
  } catch (error) {
    logger.error('Error getting refresh token', error);
    return await getItemFallback(REFRESH_TOKEN_KEY);
  }
};

/**
 * Save refresh token to storage
 */
export const saveRefreshToken = async (token: string): Promise<boolean> => {
  try {
    if (secureStoreAvailable && SecureStore) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
      return true;
    }
    if (asyncStorageAvailable && AsyncStorage) {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, token);
      return true;
    }
    await setItemFallback(REFRESH_TOKEN_KEY, token);
    return true;
  } catch (error) {
    logger.error('Error saving refresh token', error);
    try {
      await setItemFallback(REFRESH_TOKEN_KEY, token);
      return true;
    } catch {
      return false;
    }
  }
};

/**
 * Clear all tokens from storage
 */
export const clearToken = async (): Promise<boolean> => {
  try {
    if (secureStoreAvailable && SecureStore) {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      return true;
    }
    if (asyncStorageAvailable && AsyncStorage) {
      await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
      await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
      return true;
    }
    await removeItemFallback(ACCESS_TOKEN_KEY);
    await removeItemFallback(REFRESH_TOKEN_KEY);
    return true;
  } catch (error) {
    logger.error('Error clearing tokens', error);
    try {
      await removeItemFallback(ACCESS_TOKEN_KEY);
      await removeItemFallback(REFRESH_TOKEN_KEY);
      return true;
    } catch {
      return false;
    }
  }
};

/**
 * Save user data to storage
 */
export const saveUserData = async (userData: string): Promise<boolean> => {
  try {
    if (asyncStorageAvailable && AsyncStorage) {
      await AsyncStorage.setItem(USER_DATA_KEY, userData);
      return true;
    }
    await setItemFallback(USER_DATA_KEY, userData);
    return true;
  } catch (error) {
    logger.error('Error saving user data', error);
    try {
      await setItemFallback(USER_DATA_KEY, userData);
      return true;
    } catch {
      return false;
    }
  }
};

/**
 * Get user data from storage
 */
export const getUserData = async (): Promise<string | null> => {
  try {
    if (asyncStorageAvailable && AsyncStorage) {
      return await AsyncStorage.getItem(USER_DATA_KEY);
    }
    return await getItemFallback(USER_DATA_KEY);
  } catch (error) {
    logger.error('Error getting user data', error);
    return await getItemFallback(USER_DATA_KEY);
  }
};

/**
 * Clear stored user data while preserving onboarding state.
 */
export const clearUserData = async (): Promise<boolean> => {
  try {
    if (asyncStorageAvailable && AsyncStorage) {
      await AsyncStorage.removeItem(USER_DATA_KEY);
      return true;
    }
    await removeItemFallback(USER_DATA_KEY);
    return true;
  } catch (error) {
    logger.error('Error clearing user data', error);
    try {
      await removeItemFallback(USER_DATA_KEY);
      return true;
    } catch {
      return false;
    }
  }
};

/**
 * Save onboarding completion status
 */
export const saveOnboardingCompleted = async (): Promise<boolean> => {
  try {
    if (asyncStorageAvailable && AsyncStorage) {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_AT_KEY, new Date().toISOString());
      return true;
    }
    await setItemFallback(ONBOARDING_COMPLETED_KEY, 'true');
    await setItemFallback(ONBOARDING_COMPLETED_AT_KEY, new Date().toISOString());
    return true;
  } catch (error) {
    logger.error('Error saving onboarding completion', error);
    try {
      await setItemFallback(ONBOARDING_COMPLETED_KEY, 'true');
      await setItemFallback(ONBOARDING_COMPLETED_AT_KEY, new Date().toISOString());
      return true;
    } catch {
      return false;
    }
  }
};

/**
 * Get onboarding completion status
 */
export const getOnboardingCompleted = async (): Promise<boolean> => {
  try {
    let completed: string | null = null;
    if (asyncStorageAvailable && AsyncStorage) {
      completed = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
    } else {
      completed = await getItemFallback(ONBOARDING_COMPLETED_KEY);
    }
    return completed === 'true';
  } catch (error) {
    logger.error('Error getting onboarding completion', error);
    const completed = await getItemFallback(ONBOARDING_COMPLETED_KEY);
    return completed === 'true';
  }
};

/**
 * Get onboarding completion timestamp
 */
export const getOnboardingCompletedAt = async (): Promise<string | null> => {
  try {
    if (asyncStorageAvailable && AsyncStorage) {
      return await AsyncStorage.getItem(ONBOARDING_COMPLETED_AT_KEY);
    }
    return await getItemFallback(ONBOARDING_COMPLETED_AT_KEY);
  } catch (error) {
    logger.error('Error getting onboarding completion timestamp', error);
    return await getItemFallback(ONBOARDING_COMPLETED_AT_KEY);
  }
};

/**
 * Clear all stored data
 */
export const clearAll = async (): Promise<boolean> => {
  try {
    if (asyncStorageAvailable && AsyncStorage) {
      await clearToken();
      await AsyncStorage.removeItem(USER_DATA_KEY);
      await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
      await AsyncStorage.removeItem(ONBOARDING_COMPLETED_AT_KEY);
      await clearInFlightPayment();
      return true;
    }
    await clearToken();
    await removeItemFallback(USER_DATA_KEY);
    await removeItemFallback(ONBOARDING_COMPLETED_KEY);
    await removeItemFallback(ONBOARDING_COMPLETED_AT_KEY);
    await clearInFlightPayment();
    return true;
  } catch (error) {
    logger.error('Error clearing all data', error);
    try {
      await clearToken();
      await removeItemFallback(USER_DATA_KEY);
      await removeItemFallback(ONBOARDING_COMPLETED_KEY);
      await removeItemFallback(ONBOARDING_COMPLETED_AT_KEY);
      return true;
    } catch {
      return false;
    }
  }
};
