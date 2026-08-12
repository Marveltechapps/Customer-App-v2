import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import Constants from 'expo-constants';
import { tokenManager } from '../services/api/tokenManager';
import * as storage from '../utils/storage';
import { logger } from '@/utils/logger';
import {
  registerForPushNotifications,
  savePushTokenToBackend,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  getLastNotificationResponse,
  type NotificationSubscriptionLike,
} from '../services/notifications/notificationService';
import {
  registerFcmTokenAfterLogin,
  startFcmTokenRefreshListener,
  stopFcmTokenRefreshListener,
  syncFcmTokenToBackend,
} from '../services/notifications/fcmTokenService';
import {
  startFcmForegroundHandlers,
  stopFcmForegroundHandlers,
} from '../services/notifications/fcmMessagingHandlers';
import { navigateFromNotification, setOnLogoutCallback } from '../utils/navigationRef';

interface User {
  _id?: string;
  phoneNumber?: string;
  phoneVerified?: boolean;
  [k: string]: any;
}

interface UserContextValue {
  user: User | null;
  setUser: (u: User | null) => void;
  isRestoring: boolean;
  isAuthenticated: boolean;
  expoPushToken: string | null;
  /** Native FCM device token when available (Android + iOS via Firebase Messaging). */
  fcmToken: string | null;
  /**
   * Primary identifier for user-specific data (e.g. storage keys).
   * Prefers phoneNumber (normalized) as requested, falls back to _id, then "guest".
   */
  userKey: string;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const notificationListener = useRef<NotificationSubscriptionLike | null>(null);
  const responseListener = useRef<NotificationSubscriptionLike | null>(null);
  const fcmRefreshListener = useRef<NotificationSubscriptionLike | null>(null);
  const fcmForegroundListener = useRef<NotificationSubscriptionLike | null>(null);
  const expoGoPushWarnedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      try {
        await tokenManager.initialize();
        if (tokenManager.isTokenValid()) {
          const raw = await storage.getUserData();
          if (raw && mounted) {
            setUser(JSON.parse(raw));
          }
        }
        const storedFcm = await storage.getFcmToken();
        if (mounted && storedFcm) {
          setFcmToken(storedFcm);
        }
      } catch (err) {
        logger.warn('Failed to restore user session', err);
      } finally {
        if (mounted) setIsRestoring(false);
      }
    };
    restore();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setOnLogoutCallback(() => setUser(null));
    return () => setOnLogoutCallback(null);
  }, []);

  const setupPushNotifications = useCallback(async () => {
    try {
      const token = await registerForPushNotifications();
      if (token) {
        setExpoPushToken(token);
        await savePushTokenToBackend(token);
      }

      // Native FCM (Android expo path / iOS RNFB Messaging) — secure store + backend sync.
      const fcmResult = await registerFcmTokenAfterLogin();
      if (fcmResult?.token) {
        setFcmToken(fcmResult.token);
      }
    } catch (err) {
      logger.warn('Push notification setup failed', err);
    }
  }, []);

  useEffect(() => {
    const isAuthenticated = user !== null && tokenManager.isTokenValid();
    if (!isAuthenticated || isRestoring) return;
    // Skip push setup and listeners in Expo Go (dev client recommended for full support)
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) {
      if (!expoGoPushWarnedRef.current) {
        logger.warn('Skipping push registration and notification listeners in Expo Go / Expo client.');
        expoGoPushWarnedRef.current = true;
      }
      return;
    }

    // Normal flow for dev builds / standalone apps
    setupPushNotifications();

    fcmRefreshListener.current = startFcmTokenRefreshListener((refreshed) => {
      setFcmToken(refreshed.token);
      // Re-sync after rotation while the user remains authenticated.
      if (tokenManager.isTokenValid()) {
        syncFcmTokenToBackend(refreshed.token).catch(() => {});
      }
    });

    // iOS FCM: open-from-notification + foreground receive (banner via AppDelegate willPresent).
    fcmForegroundListener.current = startFcmForegroundHandlers();

    getLastNotificationResponse().then((response) => {
      if (response) {
        const data = response.notification.request.content.data;
        logger.info('App launched from notification', { data });
        navigateFromNotification(data as Record<string, any>);
      }
    }).catch(() => {});

    notificationListener.current = addNotificationReceivedListener((notification) => {
      const { title, body, data } = notification.request.content;
      logger.info('Notification received in foreground', { title });

      if (title && Platform.OS === 'android') {
        Alert.alert(
          title,
          body || '',
          [
            { text: 'Dismiss', style: 'cancel' },
            {
              text: 'View',
              onPress: () => navigateFromNotification(data as Record<string, any>),
            },
          ],
          { cancelable: true }
        );
      }
    });

    responseListener.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      logger.info('Notification tapped', { data });
      navigateFromNotification(data as Record<string, any>);
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
      fcmRefreshListener.current?.remove();
      fcmForegroundListener.current?.remove();
      stopFcmTokenRefreshListener();
      stopFcmForegroundHandlers();
    };
  }, [user, isRestoring, setupPushNotifications]);

  const isAuthenticated = user !== null && tokenManager.isTokenValid();

  const userKey = React.useMemo(() => {
    if (!user) return 'guest';
    // User requested phone number as primary key for all data fetching/storage.
    const phone = String(user.phoneNumber || '').replace(/\D/g, '');
    if (phone.length >= 10) return phone;
    return user._id || 'guest';
  }, [user]);

  return (
    <UserContext.Provider value={{ user, setUser, isRestoring, isAuthenticated, expoPushToken, fcmToken, userKey }}>
      {children}
    </UserContext.Provider>
  );
};

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}

export default UserContext;
