/**
 * Firebase Cloud Messaging (native device push token) for EAS / production builds.
 *
 * - Android: expo-notifications `getDevicePushTokenAsync` → FCM token (unchanged).
 * - iOS: @react-native-firebase/messaging `getToken` → real FCM registration token
 *   (not the raw APNs device token).
 *
 * Expo push tokens remain handled separately by notificationService.ts.
 */

import { PermissionsAndroid, Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import { logger } from '@/utils/logger';
import * as storage from '@/utils/storage';
import {
  ensureNotificationHandler,
  requestPermissions,
  type NotificationSubscriptionLike,
} from './notificationService';

const isExpoGo = Constants.appOwnership === 'expo';

export type NativePushTokenType = 'fcm' | 'apns' | 'unknown';

export type FcmTokenResult = {
  token: string;
  /** Always `fcm` when obtained via FCM (Android expo path or iOS RNFB Messaging). */
  tokenType: NativePushTokenType;
  platform: typeof Platform.OS;
};

type RnfbMessagingModule = typeof import('@react-native-firebase/messaging');

let messagingModule: RnfbMessagingModule | null | undefined;

function getRnfbMessaging(): RnfbMessagingModule | null {
  if (isExpoGo) return null;
  if (messagingModule !== undefined) return messagingModule;

  try {
    // Lazy require — native module is unavailable in Expo Go / web.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    messagingModule = require('@react-native-firebase/messaging') as RnfbMessagingModule;
  } catch (error) {
    logger.warn('@react-native-firebase/messaging unavailable', error);
    messagingModule = null;
  }
  return messagingModule;
}

/**
 * Android / legacy helper: map expo device token type.
 * iOS FCM tokens from RNFB are always `fcm`.
 */
function resolveExpoDeviceTokenType(deviceType: string | undefined): NativePushTokenType {
  if (deviceType === 'android' || Platform.OS === 'android') return 'fcm';
  if (deviceType === 'ios' || Platform.OS === 'ios') return 'apns';
  return 'unknown';
}

/**
 * Android 13+ (API 33) runtime notification permission.
 * Also covered by expo-notifications requestPermissionsAsync when POST_NOTIFICATIONS
 * is declared in app.config.js — this is an explicit Android path for clarity.
 */
export async function requestAndroidNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    if (typeof Platform.Version === 'number' && Platform.Version < 33) {
      // Pre-13: install-time notification permission; still ask expo for consistency.
      return requestPermissions();
    }

    const postNotificationsPermission =
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS ??
      ('android.permission.POST_NOTIFICATIONS' as typeof PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);

    const current = await PermissionsAndroid.check(postNotificationsPermission);
    if (current) {
      logger.info('Android POST_NOTIFICATIONS already granted');
      return true;
    }

    const result = await PermissionsAndroid.request(postNotificationsPermission, {
      title: 'Allow notifications',
      message: 'Selorg needs notification permission to send order and delivery updates.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    });

    const granted = result === PermissionsAndroid.RESULTS.GRANTED;
    logger.info('Android POST_NOTIFICATIONS request result', { result, granted });
    return granted;
  } catch (error) {
    logger.warn('Android notification permission request failed; falling back to expo-notifications', error);
    return requestPermissions();
  }
}

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const Notifications = ensureNotificationHandler();
  if (!Notifications) return;

  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#034703',
    });
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Order Updates',
      description: 'Notifications about your order status',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#034703',
    });
    await Notifications.setNotificationChannelAsync('payments', {
      name: 'Payments & Refunds',
      description: 'Notifications about payments and refunds',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#034703',
    });
  } catch (error) {
    logger.warn('Failed to create Android notification channels', error);
  }
}

/**
 * Request notification permission (Android-focused + iOS via expo-notifications).
 * iOS also registers for remote notifications via RNFB when available.
 */
export async function requestFcmNotificationPermission(): Promise<boolean> {
  if (isExpoGo) {
    logger.info('FCM permissions unavailable in Expo Go; use an EAS development/production build.');
    return false;
  }

  if (!Device.isDevice) {
    logger.warn('FCM requires a physical device');
    return false;
  }

  if (Platform.OS === 'android') {
    const androidGranted = await requestAndroidNotificationPermission();
    if (!androidGranted) return false;
    // Also align with expo-notifications permission state used by channels / listeners.
    return requestPermissions();
  }

  // iOS: expo-notifications owns the system permission prompt (RNFB requestPermission is deprecated).
  const granted = await requestPermissions();
  if (!granted) return false;

  const rnfb = getRnfbMessaging();
  if (rnfb) {
    try {
      const messaging = rnfb.getMessaging();
      if (!rnfb.isDeviceRegisteredForRemoteMessages(messaging)) {
        await rnfb.registerDeviceForRemoteMessages(messaging);
      }
    } catch (error) {
      logger.warn('iOS registerDeviceForRemoteMessages after permission failed', error);
    }
  }

  return true;
}

/** Wait briefly for APNs → FCM handoff after permission / remote registration. */
async function waitForApnsToken(
  getAPNSToken: (messaging: unknown) => Promise<string | null>,
  messaging: unknown,
  attempts = 8,
  delayMs = 400,
): Promise<string | null> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const apns = await getAPNSToken(messaging);
      if (apns) return apns;
    } catch {
      // ignore and retry
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

/**
 * iOS: obtain a real FCM registration token via React Native Firebase Messaging.
 * Requires FirebaseApp.configure() + APNs token (AppDelegate) and a physical device.
 */
async function fetchIosFcmToken(): Promise<FcmTokenResult | null> {
  const rnfb = getRnfbMessaging();
  if (!rnfb) {
    logger.warn('RNFB Messaging unavailable; cannot fetch iOS FCM token');
    return null;
  }

  const {
    getMessaging,
    getToken,
    getAPNSToken,
    registerDeviceForRemoteMessages,
    isDeviceRegisteredForRemoteMessages,
  } = rnfb;

  const messaging = getMessaging();

  try {
    if (!isDeviceRegisteredForRemoteMessages(messaging)) {
      await registerDeviceForRemoteMessages(messaging);
    }
  } catch (error) {
    logger.warn('registerDeviceForRemoteMessages failed (continuing to getToken)', error);
  }

  const apnsToken = await waitForApnsToken(getAPNSToken, messaging);
  if (!apnsToken) {
    logger.warn('APNs token not ready yet; attempting FCM getToken anyway');
  } else {
    logger.info('APNs token present before FCM getToken', {
      apnsPreview: `${apnsToken.slice(0, 8)}…`,
    });
  }

  let token = '';
  try {
    token = (await getToken(messaging))?.trim() || '';
  } catch (error) {
    // One retry after a short delay — APNs handoff can lag on first launch.
    logger.warn('iOS FCM getToken failed; retrying once', error);
    await new Promise((resolve) => setTimeout(resolve, 800));
    token = (await getToken(messaging))?.trim() || '';
  }

  if (!token) {
    logger.error('RNFB getToken returned an empty iOS FCM token');
    return null;
  }

  logger.info('iOS FCM registration token obtained', {
    tokenType: 'fcm',
    tokenPreview: `${token.slice(0, 12)}…`,
  });

  return {
    token,
    tokenType: 'fcm',
    platform: 'ios',
  };
}

/**
 * Android: expo-notifications native device push token (FCM). Unchanged.
 */
async function fetchAndroidFcmToken(): Promise<FcmTokenResult | null> {
  const Notifications = ensureNotificationHandler();
  if (!Notifications) {
    logger.warn('expo-notifications unavailable; cannot fetch FCM token');
    return null;
  }

  const deviceToken = await Notifications.getDevicePushTokenAsync();
  const token = typeof deviceToken?.data === 'string' ? deviceToken.data.trim() : '';
  if (!token) {
    logger.error('getDevicePushTokenAsync returned an empty token');
    return null;
  }

  const tokenType = resolveExpoDeviceTokenType(deviceToken?.type);
  logger.info('Native device push token obtained', {
    tokenType,
    platform: Platform.OS,
    tokenPreview: `${token.slice(0, 12)}…`,
  });

  return {
    token,
    tokenType: tokenType === 'unknown' ? 'fcm' : tokenType,
    platform: Platform.OS,
  };
}

/**
 * Fetch the native FCM device token. Does not request permission.
 * iOS → RNFB Messaging FCM token; Android → expo-notifications FCM token.
 */
export async function fetchNativeDevicePushToken(): Promise<FcmTokenResult | null> {
  try {
    if (isExpoGo) {
      logger.info('Native device push token unavailable in Expo Go');
      return null;
    }

    if (!Device.isDevice) {
      logger.warn('Native push token requires a physical device');
      return null;
    }

    if (Platform.OS === 'ios') {
      return fetchIosFcmToken();
    }

    if (Platform.OS === 'android') {
      return fetchAndroidFcmToken();
    }

    logger.warn('Unsupported platform for native FCM token', { platform: Platform.OS });
    return null;
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    logger.error('Failed to get native device push token', {
      error: err?.message || String(error),
      code: err?.code,
      platform: Platform.OS,
    });
    return null;
  }
}

/**
 * Permission → native token → secure storage. Safe to call repeatedly.
 */
export async function ensureFcmDeviceToken(): Promise<FcmTokenResult | null> {
  try {
    const granted = await requestFcmNotificationPermission();
    if (!granted) {
      logger.info('Notification permission not granted; skipping FCM token');
      return null;
    }

    await ensureAndroidChannels();

    const result = await fetchNativeDevicePushToken();
    if (!result) return null;

    const previous = await storage.getFcmToken();
    const saved = await storage.saveFcmToken(result.token);
    if (!saved) {
      logger.warn('Failed to persist FCM token to secure storage');
    }

    if (previous && previous !== result.token) {
      await storage.clearFcmTokenLastSynced();
      logger.info('FCM token changed; backend re-sync required');
    }

    return result;
  } catch (error) {
    logger.error('ensureFcmDeviceToken failed', error);
    return null;
  }
}

export async function getStoredFcmToken(): Promise<string | null> {
  try {
    return await storage.getFcmToken();
  } catch (error) {
    logger.error('Failed to read stored FCM token', error);
    return null;
  }
}

/**
 * POST native FCM token to backend after login.
 * Always registers as tokenType/provider `fcm` (iOS + Android).
 * Expo push tokens remain a separate registration path in notificationService.
 */
export async function syncFcmTokenToBackend(token?: string): Promise<boolean> {
  try {
    const resolved = (token || (await storage.getFcmToken()) || '').trim();
    if (!resolved) {
      logger.info('No FCM token to sync');
      return false;
    }

    const lastSynced = await storage.getFcmTokenLastSynced();
    if (lastSynced === resolved) {
      logger.info('FCM token already synced with backend');
      return true;
    }

    const tokenType: NativePushTokenType = 'fcm';

    await api.post(endpoints.notifications.registerToken, {
      token: resolved,
      platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'android',
      tokenType,
      provider: 'fcm',
    });

    await storage.saveFcmTokenLastSynced(resolved);
    logger.info('FCM device token registered with backend', { tokenType, platform: Platform.OS });
    return true;
  } catch (error) {
    logger.error('Failed to sync FCM token to backend', error);
    return false;
  }
}

/**
 * Full post-login flow: ensure token exists, then sync to API.
 */
export async function registerFcmTokenAfterLogin(): Promise<FcmTokenResult | null> {
  const result = await ensureFcmDeviceToken();
  if (!result) return null;
  await syncFcmTokenToBackend(result.token);
  return result;
}

type PushTokenListener = (result: FcmTokenResult) => void;

let refreshSubscription: NotificationSubscriptionLike | null = null;
let refreshListener: PushTokenListener | null = null;
let iosTokenRefreshUnsubscribe: (() => void) | null = null;

async function persistRefreshedToken(result: FcmTokenResult): Promise<void> {
  const previous = await storage.getFcmToken();
  await storage.saveFcmToken(result.token);
  if (previous !== result.token) {
    await storage.clearFcmTokenLastSynced();
  }
  logger.info('Native push token refreshed', {
    tokenType: result.tokenType,
    tokenPreview: `${result.token.slice(0, 12)}…`,
  });
  refreshListener?.(result);
}

/**
 * Listen for native token refresh (FCM rotation). Persists the new token and
 * optionally notifies the caller (e.g. to re-sync after login).
 */
export function startFcmTokenRefreshListener(
  onRefresh?: PushTokenListener,
): NotificationSubscriptionLike {
  refreshListener = onRefresh ?? null;

  if (refreshSubscription) {
    return refreshSubscription;
  }

  if (isExpoGo) {
    return { remove: () => {} };
  }

  // iOS: RNFB Messaging token refresh → real FCM token.
  if (Platform.OS === 'ios') {
    const rnfb = getRnfbMessaging();
    if (rnfb) {
      try {
        const messaging = rnfb.getMessaging();
        iosTokenRefreshUnsubscribe = rnfb.onTokenRefresh(messaging, (token: string) => {
          const trimmed = (token || '').trim();
          if (!trimmed) return;
          void persistRefreshedToken({
            token: trimmed,
            tokenType: 'fcm',
            platform: 'ios',
          }).catch((error) => logger.error('iOS FCM token refresh handler failed', error));
        });
      } catch (error) {
        logger.error('Failed to start iOS FCM token refresh listener', error);
      }
    }

    refreshSubscription = {
      remove: () => {
        try {
          iosTokenRefreshUnsubscribe?.();
        } catch {
          // ignore
        }
        iosTokenRefreshUnsubscribe = null;
        refreshSubscription = null;
        refreshListener = null;
      },
    };
    return refreshSubscription;
  }

  // Android: expo-notifications push token listener (FCM).
  const Notifications = ensureNotificationHandler();
  if (!Notifications) {
    return { remove: () => {} };
  }

  try {
    refreshSubscription = Notifications.addPushTokenListener(async (deviceToken) => {
      try {
        const token = typeof deviceToken?.data === 'string' ? deviceToken.data.trim() : '';
        if (!token) return;

        // Ignore Expo push token events — FCM only.
        if (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')) {
          return;
        }

        await persistRefreshedToken({
          token,
          tokenType: resolveExpoDeviceTokenType(deviceToken?.type) === 'apns' ? 'apns' : 'fcm',
          platform: Platform.OS,
        });
      } catch (error) {
        logger.error('FCM token refresh handler failed', error);
      }
    });
  } catch (error) {
    logger.error('Failed to start FCM token refresh listener', error);
    refreshSubscription = { remove: () => {} };
  }

  return {
    remove: () => {
      try {
        refreshSubscription?.remove();
      } catch {
        // ignore
      }
      refreshSubscription = null;
      refreshListener = null;
    },
  };
}

export function stopFcmTokenRefreshListener(): void {
  try {
    iosTokenRefreshUnsubscribe?.();
  } catch {
    // ignore
  }
  iosTokenRefreshUnsubscribe = null;
  try {
    refreshSubscription?.remove();
  } catch {
    // ignore
  }
  refreshSubscription = null;
  refreshListener = null;
}
