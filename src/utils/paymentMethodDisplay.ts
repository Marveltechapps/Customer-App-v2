import type { Order } from '../services/orders/orderService';

type PaymentLine = { label: string; amount?: number | null };

const FALLBACK_LABELS: Record<string, string> = {
  cash: 'Cash on Delivery',
  cod: 'Cash on Delivery',
  wallet: 'Selorg Wallet',
  selorg_wallet: 'Selorg Wallet',
  upi: 'UPI',
  card: 'Credit/Debit Card',
  credit_card: 'Credit Card',
  debit_card: 'Debit Card',
  netbanking: 'Net Banking',
  digital: 'Worldline (UPI/Card)',
  worldline_digital: 'Worldline (UPI/Card)',
  phonepe: 'PhonePe',
  gpay: 'Google Pay',
  paytm: 'Paytm',
};

function formatInr(amount: number) {
  return Number.isInteger(amount) ? `₹${amount}` : `₹${amount.toFixed(2)}`;
}

export function resolveOrderPaymentLines(order: Order): PaymentLine[] {
  const fromApi = order.paymentMethod?.lines?.filter((l) => l.label?.trim());
  if (fromApi && fromApi.length > 0) return fromApi;

  const detail =
    order.paymentMethodDisplay ||
    order.paymentMethod?.detailDisplay ||
    order.paymentMethod?.display ||
    order.paymentMethod?.displayLabel;

  if (detail?.includes('\n')) {
    return detail
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ label: line, amount: null }));
  }
  if (detail?.trim()) return [{ label: detail.trim(), amount: null }];

  const type = String(order.paymentMethod?.type ?? '').toLowerCase();
  const wallet = Number(order.walletDeduction ?? 0);
  const online = Number(order.onlineAmountDue ?? 0);
  if (wallet > 0 && online > 0) {
    return [
      { label: 'Selorg Wallet', amount: wallet },
      { label: FALLBACK_LABELS[type] || 'Worldline (UPI/Card)', amount: online },
    ];
  }
  return [{ label: FALLBACK_LABELS[type] || order.paymentMethod?.type || '—', amount: null }];
}

export function formatPaymentLine(line: PaymentLine): string {
  if (line.amount != null && line.amount > 0 && !/\(₹/.test(line.label)) {
    return `${line.label} (${formatInr(line.amount)})`;
  }
  return line.label;
}

export function resolveEstimatedDeliveryMessage(order: Order): string {
  const status = String(order.status ?? '').toLowerCase();
  if (['delivered', 'completed'].includes(status)) return 'Your order has been delivered.';
  if (['cancelled', 'canceled'].includes(status)) return '';
  return 'Estimated delivery: Within 30 minutes';
}
