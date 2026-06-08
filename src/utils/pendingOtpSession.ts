import { Platform } from 'react-native';
import type { LoginMode, OtpTarget } from '@/services/auth/authService';

const STORAGE_KEY = 'pending_otp_session';
const WEB_PREFIX = 'customer_auth_';

export interface PendingOtpSession {
  loginMode: LoginMode;
  otpTarget: OtpTarget;
  email?: string;
  phone?: string;
  countryCode?: string;
  channel?: string;
  displayTarget?: string;
  sessionId?: string;
}

let memorySession: PendingOtpSession | null = null;

export function getMemoryPendingOtpSession(): PendingOtpSession | null {
  return memorySession;
}

async function readSecureValue(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return typeof localStorage !== 'undefined'
        ? localStorage.getItem(WEB_PREFIX + STORAGE_KEY)
        : null;
    } catch {
      return null;
    }
  }
  const SecureStore = await import('expo-secure-store');
  return SecureStore.getItemAsync(STORAGE_KEY);
}

async function writeSecureValue(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(WEB_PREFIX + STORAGE_KEY, value);
      }
    } catch {
      /* ignore */
    }
    return;
  }
  const SecureStore = await import('expo-secure-store');
  await SecureStore.setItemAsync(STORAGE_KEY, value);
}

async function deleteSecureValue(): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(WEB_PREFIX + STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
    return;
  }
  const SecureStore = await import('expo-secure-store');
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}

export async function savePendingOtpSession(session: PendingOtpSession): Promise<void> {
  memorySession = session;
  try {
    await writeSecureValue(JSON.stringify(session));
  } catch {
    /* route params carry the session */
  }
}

export async function loadPendingOtpSession(): Promise<PendingOtpSession | null> {
  if (memorySession) return memorySession;
  try {
    const raw = await readSecureValue();
    if (!raw) return null;
    memorySession = JSON.parse(raw) as PendingOtpSession;
    return memorySession;
  } catch {
    return memorySession;
  }
}

export async function clearPendingOtpSession(): Promise<void> {
  memorySession = null;
  try {
    await deleteSecureValue();
  } catch {
    /* ignore */
  }
}
