/**
 * Firebase client initialization (JS SDK).
 *
 * Config is read from Expo `extra.firebase` (set in app.config.js from env vars)
 * with a fallback to `EXPO_PUBLIC_FIREBASE_*` for local Metro. No secrets are hardcoded.
 *
 * Native FCM (Android/iOS) still requires `google-services.json` /
 * `GoogleService-Info.plist` via app.config.js — this module prepares the JS app
 * for Analytics/Auth/etc. Push permission & token registration are intentionally
 * not implemented here yet.
 */

import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  /** Shared / default app ID when platform-specific IDs are omitted. */
  appId: string;
  appIdAndroid?: string;
  appIdIos?: string;
  measurementId?: string;
};

export type FirebaseInitResult =
  | { ok: true; app: FirebaseApp; alreadyInitialized: boolean }
  | { ok: false; reason: string };

const LOG_PREFIX = '[firebase]';

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readFromExtra(): Partial<FirebaseClientConfig> {
  try {
    const extra = Constants.expoConfig?.extra as { firebase?: Partial<FirebaseClientConfig> } | undefined;
    return extra?.firebase && typeof extra.firebase === 'object' ? extra.firebase : {};
  } catch {
    return {};
  }
}

function readFromProcessEnv(): Partial<FirebaseClientConfig> {
  // Metro inlines EXPO_PUBLIC_* at bundle time; useful for Expo Go / local dev.
  return {
    apiKey: trim(process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
    authDomain: trim(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: trim(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket: trim(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: trim(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
    appId: trim(process.env.EXPO_PUBLIC_FIREBASE_APP_ID),
    appIdAndroid: trim(process.env.EXPO_PUBLIC_FIREBASE_APP_ID_ANDROID),
    appIdIos: trim(process.env.EXPO_PUBLIC_FIREBASE_APP_ID_IOS),
    measurementId: trim(process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID),
  };
}

function pickFirst(...values: Array<string | undefined>): string {
  for (const value of values) {
    const t = trim(value);
    if (t) return t;
  }
  return '';
}

/**
 * Resolve Firebase web/client config from environment (via Expo extra or EXPO_PUBLIC_*).
 */
export function getFirebaseClientConfig(): FirebaseClientConfig | null {
  const fromExtra = readFromExtra();
  const fromEnv = readFromProcessEnv();

  const apiKey = pickFirst(fromExtra.apiKey, fromEnv.apiKey);
  const authDomain = pickFirst(fromExtra.authDomain, fromEnv.authDomain);
  const projectId = pickFirst(fromExtra.projectId, fromEnv.projectId);
  const storageBucket = pickFirst(fromExtra.storageBucket, fromEnv.storageBucket);
  const messagingSenderId = pickFirst(fromExtra.messagingSenderId, fromEnv.messagingSenderId);
  const appIdAndroid = pickFirst(fromExtra.appIdAndroid, fromEnv.appIdAndroid);
  const appIdIos = pickFirst(fromExtra.appIdIos, fromEnv.appIdIos);
  const appId = pickFirst(fromExtra.appId, fromEnv.appId, appIdAndroid, appIdIos);
  const measurementId = pickFirst(fromExtra.measurementId, fromEnv.measurementId) || undefined;

  const required: Record<string, string> = {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  };

  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    ...(appIdAndroid ? { appIdAndroid } : {}),
    ...(appIdIos ? { appIdIos } : {}),
    ...(measurementId ? { measurementId } : {}),
  };
}

function resolvePlatformAppId(config: FirebaseClientConfig): string {
  if (Platform.OS === 'ios') {
    return pickFirst(config.appIdIos, config.appId);
  }
  if (Platform.OS === 'android') {
    return pickFirst(config.appIdAndroid, config.appId);
  }
  return config.appId;
}

function toFirebaseOptions(config: FirebaseClientConfig): FirebaseOptions {
  const options: FirebaseOptions = {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: resolvePlatformAppId(config),
  };
  if (config.measurementId) {
    options.measurementId = config.measurementId;
  }
  return options;
}

function devLog(message: string, detail?: unknown): void {
  // Avoid logger circular deps; only noise in development.
  // @ts-ignore __DEV__ is defined by Metro
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    if (detail !== undefined) {
      // eslint-disable-next-line no-console
      console.info(LOG_PREFIX, message, detail);
    } else {
      // eslint-disable-next-line no-console
      console.info(LOG_PREFIX, message);
    }
  }
}

function warn(message: string, detail?: unknown): void {
  if (detail !== undefined) {
    // eslint-disable-next-line no-console
    console.warn(LOG_PREFIX, message, detail);
  } else {
    // eslint-disable-next-line no-console
    console.warn(LOG_PREFIX, message);
  }
}

let cachedApp: FirebaseApp | null = null;
let initAttempted = false;
let lastInitFailure: string | null = null;

/**
 * Initialize the default Firebase app once. Safe to call repeatedly.
 * Does not throw — returns a result so callers can degrade gracefully.
 */
export function initializeFirebase(): FirebaseInitResult {
  if (cachedApp) {
    return { ok: true, app: cachedApp, alreadyInitialized: true };
  }

  if (getApps().length > 0) {
    cachedApp = getApp();
    initAttempted = true;
    lastInitFailure = null;
    return { ok: true, app: cachedApp, alreadyInitialized: true };
  }

  const config = getFirebaseClientConfig();
  if (!config) {
    const reason =
      'Firebase config missing. Set FIREBASE_* / EXPO_PUBLIC_FIREBASE_* env vars (see .env.example).';
    initAttempted = true;
    lastInitFailure = reason;
    warn(reason);
    return { ok: false, reason };
  }

  try {
    const options = toFirebaseOptions(config);
    cachedApp = initializeApp(options);
    initAttempted = true;
    lastInitFailure = null;
    devLog('initialized', {
      projectId: config.projectId,
      platform: Platform.OS,
      appIdSuffix: options.appId?.split(':').pop(),
    });
    return { ok: true, app: cachedApp, alreadyInitialized: false };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Firebase initializeApp failed';
    initAttempted = true;
    lastInitFailure = reason;
    warn('initializeApp failed', error);
    return { ok: false, reason };
  }
}

/**
 * Returns the Firebase app if initialized (or initializes on first call).
 */
export function getFirebaseApp(): FirebaseApp | null {
  const result = initializeFirebase();
  return result.ok ? result.app : null;
}

export function isFirebaseReady(): boolean {
  return getFirebaseApp() !== null;
}

export function getFirebaseInitError(): string | null {
  if (!initAttempted) return null;
  return lastInitFailure;
}

/**
 * FCM readiness (native + JS).
 * Permission / token generation: see `src/services/notifications/fcmTokenService.ts`.
 */
export function getFirebaseMessagingPrepStatus(): {
  jsSdkReady: boolean;
  platform: typeof Platform.OS;
  /** Native Android FCM config file expected via Expo prebuild. */
  androidGoogleServicesConfigured: boolean;
  /** Native iOS FCM config file expected via Expo prebuild. */
  iosGoogleServicesConfigured: boolean;
  notes: string[];
} {
  const extra = (Constants.expoConfig?.extra ?? {}) as {
    firebaseNative?: { androidGoogleServicesFile?: string; iosGoogleServicesFile?: string };
  };
  const native = extra.firebaseNative ?? {};
  const androidConfigured = Boolean(native.androidGoogleServicesFile);
  const iosConfigured = Boolean(native.iosGoogleServicesFile);
  const notes: string[] = [];

  if (!isFirebaseReady()) {
    notes.push('JS Firebase app is not initialized; check env vars.');
  }
  if (Platform.OS === 'android' && !androidConfigured) {
    notes.push('google-services.json is not linked in app config.');
  }
  if (Platform.OS === 'ios' && !iosConfigured) {
    notes.push('GoogleService-Info.plist is not linked yet (required for iOS FCM).');
  }
  notes.push(
    'FCM: Android uses expo-notifications device tokens; iOS uses @react-native-firebase/messaging FCM tokens. Expo push remains a separate fallback.',
  );

  return {
    jsSdkReady: isFirebaseReady(),
    platform: Platform.OS,
    androidGoogleServicesConfigured: androidConfigured,
    iosGoogleServicesConfigured: iosConfigured,
    notes,
  };
}
