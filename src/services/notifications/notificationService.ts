import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import { logger } from '@/utils/logger';

/** Expo Go does not fully support `expo-notifications` (SDK 53+). Avoid requiring the module when running inside Expo Go. */
const isExpoGo = Constants.appOwnership === 'expo';

type NotificationModule = typeof import('expo-notifications');
export type NotificationSubscriptionLike = { remove: () => void };

let notificationsModule: NotificationModule | null | undefined;
let notificationHandlerConfigured = false;

function getNotificationsModule(): NotificationModule | null {
  // Avoid requiring `expo-notifications` when running inside Expo Go to prevent
  // module-level warnings and unsupported behavior. Use a development build
  // (custom dev client) for full notifications support.
  if (isExpoGo) {
    return null;
  }

  if (notificationsModule !== undefined) {
    return notificationsModule;
  }

  try {
    // Lazy require prevents Expo Go Android from throwing during app startup.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    notificationsModule = require('expo-notifications');
  } catch (error) {
    logger.warn('expo-notifications module unavailable', error);
    notificationsModule = null;
  }

  return notificationsModule;
}

function ensureNotificationHandler(): NotificationModule | null {
  const Notifications = getNotificationsModule();
  if (!Notifications) return null;

  if (!notificationHandlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    notificationHandlerConfigured = true;
  }

  return Notifications;
}

/**
 * Set up the notification handler so alerts show in the foreground.
 * Call this at app boot (e.g. in App.tsx) for best results.
 */
export function setupNotificationHandler(): void {
  ensureNotificationHandler();
}

export async function requestPermissions(): Promise<boolean> {
  const Notifications = ensureNotificationHandler();
  if (!Notifications) return false;

  if (!Device.isDevice) {
    logger.warn('Push notifications require a physical device (not a simulator/emulator)');
    return false;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  logger.info('Current notification permission status', { status: existing });
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  logger.info('Notification permission request result', { status });
  return status === 'granted';
}

export async function getExpoPushToken(): Promise<string | null> {
  try {
    const Notifications = ensureNotificationHandler();
    if (!Notifications) return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId ||
      '';

    if (!projectId) {
      logger.error(
        'EAS projectId not configured. Run: eas login && eas init, then add EAS_PROJECT_ID to your .env file.',
      );
      return null;
    }

    logger.info('Requesting Expo push token', { projectId: projectId.slice(0, 8) + '...' });
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    logger.info('Expo push token obtained', { token: tokenData.data.slice(0, 20) + '...' });
    return tokenData.data;
  } catch (err: any) {
    logger.error('Failed to get Expo push token', {
      error: err?.message || String(err),
      code: err?.code,
    });
    return null;
  }
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (isExpoGo) {
    logger.info('Push notifications are not available in Expo Go. Use a development build (custom dev client) for full support.');
    return null;
  }

  const Notifications = ensureNotificationHandler();
  if (!Notifications) return null;

  const granted = await requestPermissions();
  if (!granted) {
    logger.info('Notification permission not granted');
    return null;
  }

  if (Platform.OS === 'android') {
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
  }

  const token = await getExpoPushToken();
  return token;
}

export async function savePushTokenToBackend(token: string): Promise<void> {
  try {
    await api.post(endpoints.notifications.registerToken, {
      token,
      platform: Platform.OS,
    });
    logger.info('Push token registered with backend');
  } catch (err) {
    logger.error('Failed to save push token to backend', err);
  }
}

export function addNotificationReceivedListener(
  callback: (notification: import('expo-notifications').Notification) => void,
): NotificationSubscriptionLike {
  const Notifications = ensureNotificationHandler();
  if (!Notifications) {
    return { remove: () => {} };
  }
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseListener(
  callback: (response: import('expo-notifications').NotificationResponse) => void,
): NotificationSubscriptionLike {
  const Notifications = ensureNotificationHandler();
  if (!Notifications) {
    return { remove: () => {} };
  }
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export async function getLastNotificationResponse() {
  const Notifications = ensureNotificationHandler();
  if (!Notifications) return null;
  return Notifications.getLastNotificationResponseAsync();
}

export async function getBadgeCount(): Promise<number> {
  const Notifications = ensureNotificationHandler();
  if (!Notifications) return 0;
  return Notifications.getBadgeCountAsync();
}

export async function setBadgeCount(count: number): Promise<void> {
  const Notifications = ensureNotificationHandler();
  if (!Notifications) return;
  await Notifications.setBadgeCountAsync(count);
}
