/**
 * Map notification payload → root navigation target.
 * Aligned with selorg-webapp-v1 `resolveNotificationRoute.ts` (RN screen names).
 */

export type NotificationNavTarget =
  | { screen: 'OrderStatus' }
  | { screen: 'Orders' }
  | { screen: 'Refunds' }
  | { screen: 'Wallet' }
  | { screen: 'CustomerSupport' }
  | { screen: 'Payment'; params: { orderId: string } }
  | { screen: 'NotificationInbox' }
  | null;

type NotifData = {
  type?: string;
  orderId?: string;
  [key: string]: unknown;
};

/**
 * Resolve where a push / inbox notification should navigate.
 * Accepts web-style UPPER_SNAKE types and loose mobile variants (e.g. order_status).
 */
export function resolveNotificationNavigation(data: NotifData | null | undefined): NotificationNavTarget {
  if (!data) return null;

  const type = String(data.type ?? '').trim();
  const typeUpper = type.toUpperCase();
  const orderId = typeof data.orderId === 'string' && data.orderId.trim() ? data.orderId.trim() : undefined;

  // Loose mobile push payloads
  if (type === 'order_status' || typeUpper === 'ORDER_STATUS') {
    return { screen: 'OrderStatus' };
  }
  if (typeUpper.startsWith('REFUND')) {
    return { screen: 'Refunds' };
  }

  switch (typeUpper) {
    case 'ORDER_ON_WAY':
    case 'ORDER_ARRIVED':
      return { screen: 'OrderStatus' };

    case 'ORDER_PLACED':
    case 'COD_ORDER_PLACED':
    case 'WALLET_ORDER_PLACED':
    case 'ORDER_CONFIRMED':
    case 'ORDER_PACKED':
    case 'ORDER_DELIVERED':
    case 'ORDER_CANCELLED':
    case 'ORDER_CANCELLED_BY_STORE':
    case 'PAYMENT_PENDING':
    case 'PAYMENT_FAILED':
    case 'PAYMENT_CANCELLED':
    case 'PAYMENT_TIMEOUT':
    case 'DELIVERY_DELAYED':
    case 'DELIVERY_SLA_BREACH':
    case 'MISSING_ITEMS':
      return { screen: 'Orders' };

    case 'ORDER_AWAITING_PAYMENT':
    case 'PAYMENT_RETRY_AVAILABLE':
      return orderId
        ? { screen: 'Payment', params: { orderId } }
        : { screen: 'Orders' };

    case 'REFUND_INITIATED':
    case 'REFUND_APPROVED':
    case 'REFUND_COMPLETED':
    case 'REFUND_REJECTED':
      return { screen: 'Refunds' };

    case 'WALLET_PAYMENT_FAILED':
    case 'WALLET_CREDIT':
      return { screen: 'Wallet' };

    case 'SUPPORT_REPLY':
      return { screen: 'CustomerSupport' };

    default:
      if (orderId) return { screen: 'Orders' };
      return { screen: 'NotificationInbox' };
  }
}
