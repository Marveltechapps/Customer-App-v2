import React, { useMemo } from 'react';
import { useRoute } from '@react-navigation/native';
import type { OrdersStackRouteProp } from '../types/navigation';
import SupportLiveChat from '../components/features/support/SupportLiveChat';

const OrderChat: React.FC = () => {
  const route = useRoute<OrdersStackRouteProp<'OrderChat'>>();
  const { orderId, orderNumber } = route.params;
  const orderRef = orderNumber || orderId;

  const ticket = useMemo(
    () => ({
      subject: `Order ${orderRef} - Chat Support`,
      type: 'order_issue' as const,
      orderNumber: orderRef,
    }),
    [orderRef],
  );

  return (
    <SupportLiveChat
      headerTitle={orderNumber ? `Order #${orderNumber}` : 'Chat Support'}
      ticket={ticket}
    />
  );
};

export default OrderChat;
