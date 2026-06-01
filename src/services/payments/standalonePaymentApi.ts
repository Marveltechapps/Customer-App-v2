import { getPaymentApiBaseUrl } from '@/config/env';
import { getToken } from '@/utils/storage';
import { logger } from '@/utils/logger';

/**
 * Body for POST /api/payment/initiate. `amount` must match a server-trusted total (e.g. cart pricing
 * from `serverPricing` / cart API on Checkout) — never a user-editable field alone.
 */
export type StandaloneInitiateBody = {
  orderId: string;
  amount: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  platform?: 'android' | 'ios';
  paymentMode?: string;
};

export type StandaloneInitiateData = {
  paymentId: string;
  clientOrderRef: string;
  orderId: string;
  txnId: string;
  attemptNo: number;
  hashAlgo?: string;
  sessionPayload: unknown;
};

async function authHeaders(): Promise<HeadersInit> {
  const token = await getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isNetworkError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const name = 'name' in e ? String((e as Error).name) : '';
  const msg = 'message' in e ? String((e as Error).message) : '';
  return (
    name === 'TypeError' ||
    msg.includes('Network request failed') ||
    msg.includes('Failed to fetch') ||
    msg.includes('ECONNREFUSED')
  );
}

export async function postPaymentInitiate(body: StandaloneInitiateBody): Promise<{
  ok: true;
  data: StandaloneInitiateData;
}> {
  const token = await getToken();
  if (!token) throw new Error('NO_JWT');
  const base = getPaymentApiBaseUrl();
  const url = `${base}/api/payment/initiate`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeaders()),
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (isNetworkError(e)) throw new Error('NETWORK');
    throw e;
  }
  const text = await res.text();
  const json = parseJsonSafe(text) as { success?: boolean; data?: StandaloneInitiateData; message?: string } | null;
  if (!res.ok || !json?.success || !json.data) {
    const msg = json?.message || `Payment initiate failed (${res.status})`;
    throw new Error(msg);
  }
  return { ok: true, data: json.data };
}

export type PaymentCallbackBody = Record<string, unknown>;

/**
 * Backend POST /api/payment/callback returns `{ success: true }` whenever the payload was *processed*,
 * even if the gateway reported failure — `data.status` is then `failed` | `cancelled` | etc.
 * Only treat as a real success when Worldline captured (0300) and verification passed.
 */
export function isStandaloneCallbackPaymentSuccess(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  const status = String(d.status ?? '').toLowerCase().trim();
  if (status !== 'success') return false;
  if (d.hashOk === false) return false;
  const verr = d.verificationError;
  if (typeof verr === 'string' && verr !== '' && verr !== 'none') return false;
  return true;
}

function standaloneCallbackFailureMessage(data: unknown): string {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    const sm = d.statusMessage;
    if (typeof sm === 'string' && sm.trim()) return sm.trim();
    const status = String(d.status ?? '').toLowerCase().trim();
    if (status === 'cancelled') return 'Payment was cancelled';
    if (status === 'failed') return 'Payment was declined or failed';
    if (status === 'pending') return 'Payment is still pending. Check your order status.';
    if (status === 'unknown') return 'Payment could not be verified';
  }
  return 'Payment could not be confirmed';
}

export async function postPaymentCallback(body: PaymentCallbackBody): Promise<{
  ok: boolean;
  message?: string;
  data?: unknown;
}> {
  const token = await getToken();
  if (!token) {
    throw new Error('NO_JWT');
  }
  const base = getPaymentApiBaseUrl();
  const url = `${base}/api/payment/callback`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeaders()),
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (isNetworkError(e)) throw new Error('NETWORK');
    throw e;
  }
  const text = await res.text();
  const json = parseJsonSafe(text) as { success?: boolean; data?: unknown; message?: string } | null;
  if (!json) {
    logger.warn('payment callback: non-json response', { status: res.status, text: text.slice(0, 200) });
    return { ok: false, message: 'Invalid server response' };
  }
  if (!res.ok || !json.success) {
    return { ok: false, message: json.message || `Callback failed (${res.status})` };
  }
  if (!isStandaloneCallbackPaymentSuccess(json.data)) {
    return {
      ok: false,
      message: standaloneCallbackFailureMessage(json.data),
      data: json.data,
    };
  }
  return { ok: true, data: json.data };
}

export async function getPaymentStatus(orderIdParam: string): Promise<{ ok: boolean; data?: unknown; message?: string }> {
  const token = await getToken();
  if (!token) throw new Error('NO_JWT');
  const base = getPaymentApiBaseUrl();
  const enc = encodeURIComponent(orderIdParam);
  let res: Response;
  try {
    res = await fetch(`${base}/api/payment/status/${enc}`, {
      method: 'GET',
      headers: { ...(await authHeaders()) },
    });
  } catch (e) {
    if (isNetworkError(e)) throw new Error('NETWORK');
    throw e;
  }
  const text = await res.text();
  const json = parseJsonSafe(text) as { success?: boolean; data?: unknown; message?: string } | null;
  if (!res.ok || !json?.success) {
    return { ok: false, message: json?.message || `Status failed (${res.status})` };
  }
  return { ok: true, data: json.data };
}
