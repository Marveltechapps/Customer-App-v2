import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import { tokenManager } from '../api/tokenManager';
import * as storage from '../../utils/storage';

export interface SendOtpResponse {
  sessionId: string;
  resendCooldownSeconds?: number;
}

type SendOtpPayload = {
  phoneNumber?: string;
  phone?: string;
  channel?: 'sms' | 'whatsapp';
};

const normalizePhoneDigits = (value: string): string => String(value || '').replace(/\D/g, '');

const buildRetryPayloads = (phoneNumber: string): SendOtpPayload[] => {
  const digits = normalizePhoneDigits(phoneNumber);
  const local10 = digits.slice(-10);

  // Keep first payload fully backward-compatible with existing backend.
  const payloads: SendOtpPayload[] = [
    { phoneNumber },
    { phoneNumber: local10, phone: local10, channel: 'sms' },
    { phoneNumber: local10, phone: local10, channel: 'whatsapp' },
  ];

  // Remove malformed/duplicate entries.
  const seen = new Set<string>();
  return payloads.filter((p) => {
    const candidate = (p.phoneNumber || p.phone || '').trim();
    if (!candidate || normalizePhoneDigits(candidate).length < 10) return false;
    const key = JSON.stringify(p);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const sendOtp = async (phoneNumber: string) => {
  const payloads = buildRetryPayloads(phoneNumber);
  let lastError: unknown;

  for (let i = 0; i < payloads.length; i += 1) {
    const payload = payloads[i];
    try {
      const resp = await api.post<SendOtpResponse>(endpoints.auth.sendOtp, payload);
      try {
        // eslint-disable-next-line no-console
        console.debug('[authService] sendOtp response:', resp);
      } catch (e) {
        // ignore
      }
      return resp;
    } catch (err: any) {
      lastError = err;
      const message = String(
        err?.response?.data?.message || err?.message || ''
      ).toLowerCase();
      const isLikelyProviderFailure =
        message.includes('failed to send otp') ||
        message.includes('sms') ||
        message.includes('provider');

      const hasNextAttempt = i < payloads.length - 1;
      if (!isLikelyProviderFailure || !hasNextAttempt) {
        throw err;
      }
    }
  }

  throw lastError;
};

export const verifyOtp = async (sessionId: string, otp: string) => {
  const resp = await api.post(endpoints.auth.verifyOtp, { sessionId, otp });
  if (resp && resp.data && resp.data.accessToken) {
    await tokenManager.setTokens(resp.data.accessToken, resp.data.refreshToken);
    if (resp.data.user) {
      await storage.saveUserData(JSON.stringify(resp.data.user));
    }
  }
  return resp;
};

export const resendOtp = async (sessionId: string) => {
  const resp = await api.post(endpoints.auth.resendOtp, { sessionId });
  return resp;
};

export default { sendOtp, verifyOtp, resendOtp };

