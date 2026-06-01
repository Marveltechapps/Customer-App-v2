import { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  addNotificationReceivedListener,
  addNotificationResponseListener,
} from '../services/notifications/notificationService';
import Toast from 'react-native-toast-message';

export function useNotificationDeepLink() {
  const navigation = useNavigation<any>();
  const responseListenerRef = useRef<{ remove: () => void } | null>(null);
  const receivedListenerRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    // Foreground notification: show toast
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

    // Notification tap: deep link to relevant screen
    responseListenerRef.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (!data) return;

      const { type, orderId } = data as { type?: string; orderId?: string };

      if (type === 'order_status' && orderId) {
        navigation.navigate('OrderStatusStack', { screen: 'OrderStatusMain' });
      } else if (type?.startsWith('REFUND') && orderId) {
        navigation.navigate('RefundsStack', { screen: 'Refunds' });
      } else if (type === 'SUPPORT_REPLY') {
        navigation.navigate('CustomerSupportStack');
      } else if (type === 'WALLET_CREDIT') {
        navigation.navigate('Wallet');
      }
    });

    return () => {
      receivedListenerRef.current?.remove();
      responseListenerRef.current?.remove();
    };
  }, [navigation]);
}
