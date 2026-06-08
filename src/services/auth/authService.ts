import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import { tokenManager } from '../api/tokenManager';
import * as storage from '../../utils/storage';
import { getApiErrorMessage } from '../api/types';

export type LoginMode = 'mobile' | 'email' | 'whatsapp';
export type OtpTarget = 'phone' | 'email';
export type PreferredChannel = 'sms' | 'whatsapp' | 'email';

export interface SendOtpResponse {
  sessionId: string;
  channel?: string;
  resendCooldownSeconds?: number;
}

export interface SendLoginOtpParams {
  loginMode: LoginMode;
  countryCode?: string;
  phone?: string;
  email?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getPreferredChannel(loginMode: LoginMode): PreferredChannel {
  if (loginMode === 'whatsapp') return 'whatsapp';
  if (loginMode === 'email') return 'email';
  return 'sms';
}

export function getChannelLabel(channel?: string, loginMode?: LoginMode): string {
  const normalized = (channel ?? '').toLowerCase();
  if (normalized.includes('whatsapp')) return 'WhatsApp';
  if (normalized.includes('sms')) return 'SMS';
  if (normalized.includes('email')) return 'Email';
  if (loginMode === 'whatsapp') return 'WhatsApp';
  if (loginMode === 'email') return 'Email';
  return 'SMS';
}

export function validateEmailFormat(email: string): boolean {
  return EMAIL_REGEX.test((email ?? '').trim());
}

export function isCompleteEmail(email: string): boolean {
  const trimmed = (email ?? '').trim().toLowerCase();
  if (!EMAIL_REGEX.test(trimmed)) return false;
  const tld = trimmed.split('.').pop() ?? '';
  return tld.length >= 2;
}

function normalizeIndianPhone(phone: string): string {
  const digits = (phone ?? '').toString().replace(/\D/g, '');
  if (digits.length === 10 && /^[5-9]/.test(digits)) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function isValidIndianPhone(phone: string): boolean {
  const normalized = normalizeIndianPhone(phone);
  return normalized.length === 10 && /^[5-9]/.test(normalized);
}

export async function sendLoginOtp(params: SendLoginOtpParams): Promise<SendOtpResponse> {
  let payload: Record<string, string>;

  if (params.loginMode === 'email') {
    const email = (params.email ?? '').trim().toLowerCase();
    if (!email) throw new Error('Enter email address');
    if (!validateEmailFormat(email)) throw new Error('Please enter a valid email address');
    payload = { email, preferredChannel: 'email', channel: 'email' };
  } else {
    const nationalDigits = (params.phone ?? '').replace(/\D/g, '');
    if (!nationalDigits) {
      throw new Error(
        params.loginMode === 'whatsapp' ? 'Enter WhatsApp number' : 'Enter mobile number'
      );
    }

    const dial = params.countryCode ?? '+91';
    if (dial !== '+91') {
      throw new Error('Only Indian mobile numbers (+91) are supported at this time.');
    }

    if (!isValidIndianPhone(nationalDigits)) {
      throw new Error('Invalid number format');
    }

    const preferredChannel = getPreferredChannel(params.loginMode);
    const phoneNumber = normalizeIndianPhone(nationalDigits);
    payload = {
      phoneNumber,
      phone: phoneNumber,
      channel: preferredChannel,
      preferredChannel,
    };
  }

  const resp = await api.post<SendOtpResponse & { data?: SendOtpResponse }>(
    endpoints.auth.sendOtp,
    payload,
    params.loginMode === 'email' ? { timeout: 90000 } : undefined
  );

  const sessionId = (resp as SendOtpResponse).sessionId ?? resp.data?.sessionId;
  if (!sessionId) {
    throw new Error(getApiErrorMessage(resp, 'Failed to send OTP'));
  }

  return {
    sessionId,
    channel: (resp as SendOtpResponse).channel ?? resp.data?.channel,
    resendCooldownSeconds:
      (resp as SendOtpResponse).resendCooldownSeconds ?? resp.data?.resendCooldownSeconds,
  };
}

/** @deprecated Use sendLoginOtp */
export const sendOtp = async (phoneNumber: string) => {
  return sendLoginOtp({ loginMode: 'mobile', countryCode: '+91', phone: phoneNumber });
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

export const resendOtp = async (sessionId: string, loginMode?: LoginMode) => {
  const resp = await api.post<{ resendCooldownSeconds?: number; channel?: string }>(
    endpoints.auth.resendOtp,
    { sessionId },
    loginMode === 'email' ? { timeout: 90000 } : undefined
  );
  return resp;
};

export async function resendLoginOtp(sessionId: string, loginMode?: LoginMode) {
  try {
    return await resendOtp(sessionId, loginMode);
  } catch (err) {
    throw new Error(getApiErrorMessage(err, 'Failed to resend OTP'));
  }
}

export default { sendLoginOtp, sendOtp, verifyOtp, resendOtp, resendLoginOtp };
