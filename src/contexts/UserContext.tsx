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
  const notificationListener = useRef<NotificationSubscriptionLike | null>(null);
  const responseListener = useRef<NotificationSubscriptionLike | null>(null);

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
      logger.warn('Skipping push registration and notification listeners in Expo Go / Expo client.');
      return;
    }

    // Normal flow for dev builds / standalone apps
    setupPushNotifications();

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
    <UserContext.Provider value={{ user, setUser, isRestoring, isAuthenticated, expoPushToken, userKey }}>
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

