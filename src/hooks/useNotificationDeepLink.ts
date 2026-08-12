/**
 * Notification tap / inbox open → navigate using shared resolver.
 */

import { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  addNotificationReceivedListener,
  addNotificationResponseListener,
} from '../services/notifications/notificationService';
import Toast from 'react-native-toast-message';
import { resolveNotificationNavigation } from '../utils/resolveNotificationNavigation';
import type { RootStackNavigationProp } from '../types/navigation';

function navigateToTarget(
  navigation: RootStackNavigationProp,
  target: NonNullable<ReturnType<typeof resolveNotificationNavigation>>
) {
  if (target.screen === 'Payment') {
    navigation.navigate('Payment', target.params);
    return;
  }
  navigation.navigate(target.screen as never);
}

export function useNotificationDeepLink() {
  const navigation = useNavigation<RootStackNavigationProp>();
  const responseListenerRef = useRef<{ remove: () => void } | null>(null);
  const receivedListenerRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    receivedListenerRef.current = addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content;
      if (title || body) {
        Toast.show({
          type: 'info',
          text1: title || '',
          text2: body || '',
          visibilityTime: 4000,
          topOffset: 60,
        });
      }
    });

    responseListenerRef.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      if (!data) return;

      const target = resolveNotificationNavigation({
        type: typeof data.type === 'string' ? data.type : undefined,
        orderId: typeof data.orderId === 'string' ? data.orderId : undefined,
        ...data,
      });
      if (target) navigateToTarget(navigation, target);
    });

    return () => {
      receivedListenerRef.current?.remove();
      responseListenerRef.current?.remove();
    };
  }, [navigation]);
}
