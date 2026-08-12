/**
 * React Native Firebase Messaging receive / open handlers (iOS-focused).
 *
 * Token registration lives in fcmTokenService.ts.
 * Display notification + data payloads from the backend are handled here for
 * foreground, background, and quit → open flows.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { logger } from '@/utils/logger';
import { navigateFromNotification } from '@/utils/navigationRef';

const isExpoGo = Constants.appOwnership === 'expo';

type RnfbMessagingModule = typeof import('@react-native-firebase/messaging');
type RemoteMessage = import('@react-native-firebase/messaging').RemoteMessage;

let messagingModule: RnfbMessagingModule | null | undefined;
let backgroundHandlerRegistered = false;
let foregroundUnsubs: Array<() => void> = [];

function getRnfbMessaging(): RnfbMessagingModule | null {
  if (isExpoGo) return null;
  if (messagingModule !== undefined) return messagingModule;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    messagingModule = require('@react-native-firebase/messaging') as RnfbMessagingModule;
  } catch (error) {
    logger.warn('@react-native-firebase/messaging unavailable for handlers', error);
    messagingModule = null;
  }
  return messagingModule;
}

/** Normalize FCM RemoteMessage into the shape navigateFromNotification expects. */
export function remoteMessageToNavData(message: RemoteMessage | null | undefined): Record<string, any> | null {
  if (!message) return null;
  const data = (message.data || {}) as Record<string, any>;
  const notification = message.notification;
  return {
    ...data,
    title: notification?.title || data.title,
    body: notification?.body || data.body,
    messageId: message.messageId,
  };
}

/**
 * Must run as early as possible (index.js) — before App mounts.
 * Required for data messages while backgrounded / quit on both platforms.
 */
export function registerFcmBackgroundMessageHandler(): void {
  if (backgroundHandlerRegistered || isExpoGo) return;

  const rnfb = getRnfbMessaging();
  if (!rnfb) return;

  try {
    const messaging = rnfb.getMessaging();
    rnfb.setBackgroundMessageHandler(messaging, async (remoteMessage) => {
      logger.info('FCM background message', {
        messageId: remoteMessage?.messageId,
        hasNotification: Boolean(remoteMessage?.notification),
        dataKeys: Object.keys(remoteMessage?.data || {}),
      });
    });
    backgroundHandlerRegistered = true;
    logger.info('FCM background message handler registered');
  } catch (error) {
    logger.error('Failed to register FCM background message handler', error);
  }
}

export type FcmForegroundHandlersOptions = {
  /** Called when a message arrives while the app is in the foreground. */
  onForegroundMessage?: (message: RemoteMessage) => void;
};

/**
 * Foreground receive + notification-open listeners.
 * Safe to call once after login / when authenticated.
 */
export function startFcmForegroundHandlers(
  options: FcmForegroundHandlersOptions = {},
): { remove: () => void } {
  stopFcmForegroundHandlers();

  if (isExpoGo) {
    return { remove: () => {} };
  }

  // iOS uses RNFB for FCM delivery; Android primarily uses expo-notifications,
  // but RNFB handlers are still useful when the native Firebase path is active.
  const rnfb = getRnfbMessaging();
  if (!rnfb) {
    return { remove: () => {} };
  }

  try {
    const messaging = rnfb.getMessaging();

    const unsubMessage = rnfb.onMessage(messaging, (remoteMessage) => {
      logger.info('FCM foreground message', {
        platform: Platform.OS,
        messageId: remoteMessage?.messageId,
        title: remoteMessage?.notification?.title,
      });
      options.onForegroundMessage?.(remoteMessage);
    });
    foregroundUnsubs.push(unsubMessage);

    const unsubOpened = rnfb.onNotificationOpenedApp(messaging, (remoteMessage) => {
      logger.info('App opened from FCM notification (background)', {
        messageId: remoteMessage?.messageId,
      });
      const data = remoteMessageToNavData(remoteMessage);
      if (data) navigateFromNotification(data);
    });
    foregroundUnsubs.push(unsubOpened);

    void rnfb
      .getInitialNotification(messaging)
      .then((remoteMessage) => {
        if (!remoteMessage) return;
        logger.info('App opened from FCM notification (quit)', {
          messageId: remoteMessage.messageId,
        });
        const data = remoteMessageToNavData(remoteMessage);
        if (data) {
          // Defer slightly so NavigationContainer is ready.
          setTimeout(() => navigateFromNotification(data), 400);
        }
      })
      .catch((error) => {
        logger.warn('getInitialNotification failed', error);
      });
  } catch (error) {
    logger.error('Failed to start FCM foreground handlers', error);
  }

  return {
    remove: () => stopFcmForegroundHandlers(),
  };
}

export function stopFcmForegroundHandlers(): void {
  for (const unsub of foregroundUnsubs) {
    try {
      unsub();
    } catch {
      // ignore
    }
  }
  foregroundUnsubs = [];
}
