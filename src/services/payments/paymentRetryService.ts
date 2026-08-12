/**
 * Payment retry / abort helpers — parity with web paymentService.
 */

import { Platform } from 'react-native';
import { api } from '../api/client';
import { endpoints } from '../api/endpoints';

export type PaymentRetryStatus = {
  canRetry: boolean;
  reason?: string;
  paymentOutcome?: string;
  status?: string;
  retryCount?: number;
};

function extractMessage(res: unknown, fallback: string): string {
  if (!res || typeof res !== 'object') return fallback;
  const r = res as { error?: string; message?: string };
  return r.error || r.message || fallback;
}

export async function fetchPaymentRetryStatus(orderId: string): Promise<PaymentRetryStatus> {
  const res = await api.get<Record<string, unknown>>(endpoints.payments.retryStatus(orderId));
  if (!res.success) {
    throw new Error(extractMessage(res, 'Unable to check payment retry status'));
  }
  const payload = (res.data ?? {}) as Record<string, unknown>;
  const reason = payload.reason
    ? String(payload.reason)
    : payload.error
      ? String(payload.error)
      : undefined;
  return {
    canRetry: Boolean(payload.canRetry ?? (payload.allowed ?? !reason)),
    reason,
    paymentOutcome:
      payload.paymentOutcome != null
        ? String(payload.paymentOutcome)
        : payload.outcome != null
          ? String(payload.outcome)
          : undefined,
    status: payload.status != null ? String(payload.status) : undefined,
    retryCount: payload.retryCount != null ? Number(payload.retryCount) : undefined,
  };
}

/**
 * Marks retry intent on the server. Backend returns nextAction: createWorldlineSession —
 * caller should then call createWorldlineSession(orderId) and open the gateway.
 */
export async function preparePaymentRetry(
  orderId: string,
  options?: { paymentMode?: string }
): Promise<{ orderId: string; nextAction?: string; retryCount?: number }> {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const res = await api.post<Record<string, unknown>>(endpoints.payments.retry(orderId), {
    platform,
    paymentMode: options?.paymentMode ?? 'all',
  });
  if (!res.success) {
    throw new Error(extractMessage(res, 'Payment retry could not be started.'));
  }
  const data = (res.data ?? {}) as Record<string, unknown>;
  return {
    orderId: String(data.orderId ?? orderId),
    nextAction: data.nextAction != null ? String(data.nextAction) : undefined,
    retryCount: data.retryCount != null ? Number(data.retryCount) : undefined,
  };
}

export async function abortWorldlinePayment(
  orderId: string,
  txnId: string,
  reason?: string
): Promise<void> {
  const res = await api.post(endpoints.payments.worldline.abort, {
    orderId,
    txnId,
    reason,
  });
  if (!res.success) {
    throw new Error(extractMessage(res, 'Unable to abort payment'));
  }
}

export async function recordPaymentFailure(orderId: string, reason: string): Promise<void> {
  try {
    await api.post(endpoints.payments.recordFailure, { orderId, reason });
  } catch {
    // Best-effort telemetry — never block UX
  }
}
