/**
 * Environment Configuration (same method as HHD and Picker apps)
 * Priority: expo extra (from app.config.js) → env-based default. API client uses apiBaseUrl.
 *
 * Note: This file does not use the logger utility to avoid circular dependencies.
 * Logger depends on env.ts, so env.ts uses console directly for error reporting.
 */

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { NativeModules, Platform } from 'react-native';

export type Environment = 'development' | 'staging' | 'production';
export type Mode = 'dev' | 'prod';

/** Backend port (match unified backend `PORT`). Avoid 5000 (AirPlay) and 5554–5585 (Android emulator). */
export const DEFAULT_BACKEND_PORT = 3333;

/** Standalone payment routes (`/api/payment/*`) — same host as main API in local dev. */
const DEFAULT_PAYMENT_API_BASE_URL = 'http://localhost:3333';

const CUSTOMER_API_PATH = '/api/v1/customer';
/** Default API base URL for development. Use this so frontend and backend stay in sync. */
export const DEFAULT_DEV_API_BASE_URL = `http://localhost:${DEFAULT_BACKEND_PORT}${CUSTOMER_API_PATH}`;

type DevHostKind = 'lan' | 'tunnel' | 'unknown';
type DevHostInfo = { kind: DevHostKind; host: string | null; source: 'scriptURL' | 'expoConfig' | 'none' };

interface EnvConfig {
  env: Environment;
  apiBaseUrl: string;
  apiVersion: string;
  enableLogging: boolean;
  enableAnalytics: boolean;
}

// Fallback when config cannot be read (e.g. Constants unavailable). Default to local backend.
const DEFAULT_CONFIG: EnvConfig = {
  env: 'development',
  apiBaseUrl: DEFAULT_DEV_API_BASE_URL,
  apiVersion: '/api/v1',
  enableLogging: true,
  enableAnalytics: true,
};

/**
 * Safely get a config value from expo-constants with fallback
 */
const getConfigValue = (key: string, defaultValue: string): string => {
  try {
    const extra = Constants.expoConfig?.extra;
    if (extra && typeof extra === 'object' && key in extra) {
      const value = extra[key];
      return value !== null && value !== undefined ? String(value) : defaultValue;
    }
    return defaultValue;
  } catch (error) {
    // Use console directly to avoid circular dependency with logger
    // Only log in development to avoid noise in production
    // @ts-ignore - __DEV__ is a global defined by React Native/Metro bundler
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(`[env] Error accessing config key ${key}:`, error);
    }
    return defaultValue;
  }
};

function normalizeMode(raw: unknown): Mode | null {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'dev' || v === 'development') return 'dev';
  if (v === 'prod' || v === 'production') return 'prod';
  return null;
}

function modeToEnv(mode: Mode): Environment {
  return mode === 'prod' ? 'production' : 'development';
}

function isIpv4Address(value: string): boolean {
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) return false;
  return value.split('.').every((octet) => {
    const n = Number(octet);
    return Number.isInteger(n) && n >= 0 && n <= 255;
  });
}

function isPrivateLanIpv4(value: string): boolean {
  if (!isIpv4Address(value)) return false;
  const [a, b] = value.split('.').map((x) => Number(x));
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

function isTunnelHostname(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.endsWith('.exp.direct');
}

function isMdnsHostname(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.endsWith('.local');
}

function normalizeDevHostCandidate(host: string): { kind: DevHostKind; host: string | null } {
  const h = String(host || '').trim();
  if (!h || h === 'localhost' || h === '127.0.0.1') return { kind: 'unknown', host: null };
  if (isTunnelHostname(h)) return { kind: 'tunnel', host: h };
  if (isMdnsHostname(h)) return { kind: 'lan', host: h };
  if (isPrivateLanIpv4(h)) return { kind: 'lan', host: h };
  return { kind: 'unknown', host: null };
}

/**
 * Detect the host machine IP that Expo/Metro uses to serve the JS bundle.
 * This IP is guaranteed reachable from the device/emulator, so we reuse it
 * for backend API calls that point at localhost.
 */
function getExpoHostInfo(): DevHostInfo {
  try {
    const hostUri =
      Constants.expoConfig?.hostUri ??
      (Constants as any).manifest?.debuggerHost ??
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
    if (typeof hostUri === 'string' && hostUri.length > 0) {
      const host = hostUri.split(':')[0] || '';
      const normalized = normalizeDevHostCandidate(host);
      return { kind: normalized.kind, host: normalized.host, source: 'expoConfig' };
    }
  } catch {
    // ignore
  }
  return { kind: 'unknown', host: null, source: 'none' };
}

function hostFromScriptUrlInfo(): DevHostInfo {
  try {
    const scriptURL = (NativeModules as any)?.SourceCode?.scriptURL;
    if (typeof scriptURL !== 'string' || !scriptURL.trim()) {
      return { kind: 'unknown', host: null, source: 'none' };
    }
    const url = new URL(scriptURL);
    const host = url.hostname || '';
    const normalized = normalizeDevHostCandidate(host);
    return { kind: normalized.kind, host: normalized.host, source: 'scriptURL' };
  } catch {
    return { kind: 'unknown', host: null, source: 'none' };
  }
}

function getDevHostInfo(): DevHostInfo {
  const fromScript = hostFromScriptUrlInfo();
  if (fromScript.kind !== 'unknown' && fromScript.host) return fromScript;
  const fromExpo = getExpoHostInfo();
  if (fromExpo.kind !== 'unknown' && fromExpo.host) return fromExpo;
  return { kind: 'unknown', host: null, source: 'none' };
}

function parseUrlOrNull(value: string): URL | null {
  try {
    const t = String(value || '').trim();
    if (!t) return null;
    return new URL(t);
  } catch {
    return null;
  }
}

function normalizeConfiguredBaseUrl(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

function ensureCustomerApiPath(urlString: string): string {
  const cleaned = normalizeConfiguredBaseUrl(urlString);
  const u = parseUrlOrNull(cleaned);
  if (!u) return cleaned;
  if (u.pathname === '/' || u.pathname === '') {
    u.pathname = CUSTOMER_API_PATH;
    return u.toString().replace(/\/+$/, '');
  }
  if (!u.pathname.endsWith(CUSTOMER_API_PATH)) {
    // If they provided an origin only, append. If they provided some other path, don't guess.
    // We only auto-append when path is empty/'/'.
    return u.toString().replace(/\/+$/, '');
  }
  return u.toString().replace(/\/+$/, '');
}

function replaceLocalhostInUrl(urlString: string, replacementHost: string): string {
  return urlString.replace(/localhost/gi, replacementHost).replace(/127\.0\.0\.1/g, replacementHost);
}

/** When .env pins an old LAN IP, follow the host Expo/Metro uses (same machine as the JS bundle). */
function syncPrivateLanHostWithDevHost(urlString: string, devHost: DevHostInfo): string {
  if (devHost.kind !== 'lan' || !devHost.host) return urlString;
  const u = parseUrlOrNull(urlString);
  if (!u || !isPrivateLanIpv4(u.hostname) || u.hostname === devHost.host) return urlString;
  u.hostname = devHost.host;
  return u.toString().replace(/\/+$/, '');
}

function apiUrlNeedsDevHostRewrite(apiBaseUrl: string): boolean {
  if (/localhost|127\.0\.0\.1/i.test(apiBaseUrl)) return true;
  const devHost = getDevHostInfo();
  if (devHost.kind !== 'lan' || !devHost.host) return false;
  const u = parseUrlOrNull(apiBaseUrl);
  return Boolean(u && isPrivateLanIpv4(u.hostname) && u.hostname !== devHost.host);
}

/**
 * Replace localhost/127.0.0.1 in the API URL with the reachable host IP.
 * Priority: detect tunnel (exp.direct) → use configured tunnel URL → else LAN host rewrite → Android emulator alias 10.0.2.2.
 * Also fix port 3000 → backend port to avoid hitting the Vite dev server.
 */
function normalizeApiBaseUrl(apiBaseUrl: string, env: Environment): string {
  if (env !== 'development') return apiBaseUrl;
  try {
    let url = apiBaseUrl.trim();
    const lower = url.toLowerCase();
    const isLocalhost = /localhost|127\.0\.0\.1/i.test(lower);

    // If a hosted/prod URL is accidentally supplied while running a dev build,
    // force the local unified backend so local testing stays consistent.
    if (lower.includes('api.selorg.com')) {
      url = DEFAULT_DEV_API_BASE_URL;
    }

    const devHost = getDevHostInfo();
    if (devHost.kind === 'tunnel') {
      const configuredTunnelCustomer = ensureCustomerApiPath(getConfigValue('tunnelApiBaseUrl', ''));
      if (configuredTunnelCustomer) {
        // @ts-ignore __DEV__ may be global in RN/Expo
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          // eslint-disable-next-line no-console
          console.info('[env] tunnel detected; using tunnelApiBaseUrl', {
            detectedHost: devHost.host,
            source: devHost.source,
            apiBaseUrl: configuredTunnelCustomer,
          });
        }
        return configuredTunnelCustomer;
      }
      // @ts-ignore __DEV__
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[env] tunnel detected but tunnelApiBaseUrl is not set; requests may fail on real devices', {
          detectedHost: devHost.host,
          source: devHost.source,
          fallbackApiBaseUrl: url,
        });
      }
      // If tunnel is detected but missing config, fall back to the original URL (likely localhost) so logs reveal it.
      return url;
    }

    // Stale .env LAN IP while Metro serves the bundle from a different address on the same PC.
    url = syncPrivateLanHostWithDevHost(url, devHost);

    if (!isLocalhost) return url;

    if (lower.includes('localhost:3000') || lower.includes('127.0.0.1:3000')) {
      url = DEFAULT_DEV_API_BASE_URL;
    }

    // Android emulator cannot reach host localhost; iOS simulator can.
    // Real iOS devices also cannot reach "localhost" on your laptop, so prefer LAN IP when available.
    const replacementIP = devHost.kind === 'lan' && devHost.host ? devHost.host : Platform.OS === 'android' ? '10.0.2.2' : null;

    if (replacementIP) {
      url = replaceLocalhostInUrl(url, replacementIP);
    }

    // @ts-ignore __DEV__
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.info('[env] dev apiBaseUrl resolved', {
        devHostKind: devHost.kind,
        devHost: devHost.host,
        source: devHost.source,
        apiBaseUrl: url,
      });
    }

    return url;
  } catch {
    // ignore
  }
  return apiBaseUrl;
}

/**
 * Rewrite localhost / 127.0.0.1 in absolute media URLs (banner images, etc.) so they load on
 * physical devices and Android emulator — same host replacement rules as the API client.
 * Relative paths are unchanged; call after resolving to an absolute URL.
 */
/**
 * Base URL for `/api/payment/initiate`, `/api/payment/callback`, `/api/payment/status/:id`.
 * Uses `paymentApiBaseUrl` from app config (or PAYMENT_API_BASE_URL at build time via app.config.js).
 * In development, localhost is rewritten for physical devices the same way as the main API.
 */
export function getPaymentApiBaseUrl(): string {
  try {
    let mode = normalizeMode(getConfigValue('mode', 'dev'));
    // @ts-ignore __DEV__
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      mode = 'dev';
    }
    const env = (mode ? modeToEnv(mode) : (getConfigValue('env', 'development') || 'development')) as Environment;
    let url = getConfigValue('paymentApiBaseUrl', DEFAULT_PAYMENT_API_BASE_URL).trim();
    if (env === 'development') {
      const devHost = getDevHostInfo();
      if (devHost.kind === 'tunnel') {
        const configured = normalizeConfiguredBaseUrl(getConfigValue('tunnelPaymentApiBaseUrl', ''));
        if (configured) {
          // @ts-ignore __DEV__
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            // eslint-disable-next-line no-console
            console.info('[env] tunnel detected; using tunnelPaymentApiBaseUrl', {
              detectedHost: devHost.host,
              source: devHost.source,
              paymentApiBaseUrl: configured,
            });
          }
          return configured;
        }
        const configuredFromCustomer = normalizeConfiguredBaseUrl(getConfigValue('tunnelApiBaseUrl', ''));
        const u = parseUrlOrNull(configuredFromCustomer);
        if (u) {
          const derived = `${u.protocol}//${u.host}`;
          // @ts-ignore __DEV__
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            // eslint-disable-next-line no-console
            console.info('[env] tunnel detected; derived paymentApiBaseUrl from tunnelApiBaseUrl origin', {
              detectedHost: devHost.host,
              source: devHost.source,
              paymentApiBaseUrl: derived,
            });
          }
          return derived;
        }
        // @ts-ignore __DEV__
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[env] tunnel detected but no tunnelPaymentApiBaseUrl/tunnelApiBaseUrl configured; payment calls may fail', {
            detectedHost: devHost.host,
            source: devHost.source,
            fallbackPaymentApiBaseUrl: url,
          });
        }
        return url.replace(/\/+$/, '');
      }
      url = normalizeApiBaseUrl(url, env);
    }
    return url.replace(/\/+$/, '');
  } catch {
    return DEFAULT_PAYMENT_API_BASE_URL;
  }
}

export function rewriteLocalhostInMediaUrl(urlString: string): string {
  const trimmed = urlString?.trim();
  if (!trimmed) return urlString;
  try {
    const mode = normalizeMode(getConfigValue('mode', 'dev'));
    const env = (mode ? modeToEnv(mode) : (getConfigValue('env', 'development') || 'development')) as Environment;
    if (env !== 'development') return trimmed;
    if (!/^https?:\/\//i.test(trimmed)) return trimmed;
    const u = new URL(trimmed);
    const devHost = getDevHostInfo();
    if (devHost.kind === 'tunnel') {
      const configuredFromCustomer = normalizeConfiguredBaseUrl(getConfigValue('tunnelApiBaseUrl', ''));
      const base = parseUrlOrNull(configuredFromCustomer);
      if (base) {
        u.protocol = base.protocol;
        u.hostname = base.hostname;
        u.port = base.port;
        return u.toString();
      }
      return trimmed;
    }

    const synced = syncPrivateLanHostWithDevHost(trimmed, devHost);
    if (synced !== trimmed) return synced;

    if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return trimmed;

    const replacementHost =
      devHost.kind === 'lan' && devHost.host ? devHost.host : Platform.OS === 'android' ? '10.0.2.2' : null;
    if (replacementHost) {
      u.hostname = replacementHost;
      return u.toString();
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

/**
 * Get environment configuration
 */
export const getEnvConfig = (): EnvConfig => {
  try {
    // Prefer MODE (dev/prod) and map it to our existing Environment type.
    // Back-compat: if mode is missing, fall back to existing `env`.
    let mode = normalizeMode(getConfigValue('mode', 'dev'));
    // Metro / simulator / Expo Go: never use hosted API from .env (mode=prod breaks local OTP).
    // Release/EAS builds set __DEV__ false; eas.json still supplies MODE=prod.
    // @ts-ignore __DEV__ is a global in RN/Expo
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      mode = 'dev';
    }
    const env = (mode ? modeToEnv(mode) : (getConfigValue('env', 'development') || 'development')) as Environment;
    const defaultApiBaseUrl =
      env === 'development' ? DEFAULT_DEV_API_BASE_URL : DEFAULT_CONFIG.apiBaseUrl;

    let apiBaseUrl = getConfigValue('apiBaseUrl', defaultApiBaseUrl);
    // @ts-ignore __DEV__
    if (typeof __DEV__ !== 'undefined' && __DEV__ && apiBaseUrl.toLowerCase().includes('api.selorg.com')) {
      apiBaseUrl = defaultApiBaseUrl;
    }
    apiBaseUrl = normalizeApiBaseUrl(apiBaseUrl, env);

    return {
      env,
      apiBaseUrl,
      apiVersion: getConfigValue('apiVersion', DEFAULT_CONFIG.apiVersion),
      enableLogging: getConfigValue('enableLogging', 'true') === 'true',
      enableAnalytics: getConfigValue('enableAnalytics', 'true') === 'true',
    };
  } catch (error) {
    // Use console directly to avoid circular dependency with logger
    // Only log in development to avoid noise in production
    // @ts-ignore - __DEV__ is a global defined by React Native/Metro bundler
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.error('[env] Error getting environment config, using defaults:', error);
    }
    return DEFAULT_CONFIG;
  }
};

/**
 * Current environment configuration (lazy-loaded)
 */
let cachedEnvConfig: EnvConfig | null = null;

export const getEnvConfigSafe = (): EnvConfig => {
  const needsHostRewrite =
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    (!cachedEnvConfig ||
      apiUrlNeedsDevHostRewrite(cachedEnvConfig.apiBaseUrl));

  if (!cachedEnvConfig || needsHostRewrite) {
    const devHost = getDevHostInfo();
    if (!cachedEnvConfig || (needsHostRewrite && devHost.kind !== 'unknown' && devHost.host)) {
      cachedEnvConfig = getEnvConfig();
    }
  }
  return cachedEnvConfig;
};

export const resetEnvCache = (): void => {
  cachedEnvConfig = null;
};

/**
 * Current environment configuration
 * @deprecated Use getEnvConfigSafe() for safer access (lazy; avoids stale localhost before Expo host is ready)
 */
export const envConfig: EnvConfig = DEFAULT_CONFIG;

/**
 * Check if running in development
 */
export const isDevelopment = (): boolean => {
  try {
    return getEnvConfigSafe().env === 'development';
  } catch {
    return true; // Default to development if config fails
  }
};

/**
 * Check if running in production
 */
export const isProduction = (): boolean => {
  try {
    return getEnvConfigSafe().env === 'production';
  } catch {
    return false;
  }
};

/**
 * Check if running in staging
 */
export const isStaging = (): boolean => {
  try {
    return getEnvConfigSafe().env === 'staging';
  } catch {
    return false;
  }
};

/**
 * iOS simulator detection for image/network workarounds in development.
 */
export const isIosSimulator = (): boolean => {
  if (Platform.OS !== 'ios') return false;
  try {
    // expo-device exposes physical vs simulator.
    return Device.isDevice === false;
  } catch {
    return false;
  }
};

/**
 * SSL pinning is not configured in this app. Keep explicit helper for diagnostics.
 */
export const isSslPinningEnabledForImages = (): boolean => false;

/**
 * Development-only image fallback mode for iOS simulator.
 * Can be overridden by app.config extra.useSimulatorImagePlaceholder ("true"/"false").
 * 
 * DISABLED BY DEFAULT: Always attempt to load images from remote URLs.
 * Only use placeholder if explicitly enabled via config.
 */
export const shouldUseSimulatorImagePlaceholder = (): boolean => {
  try {
    const override = getConfigValue('useSimulatorImagePlaceholder', '');
    if (override === 'true') return true;
  } catch {
    // ignore
  }
  // Default: disabled (always attempt remote load)
  return false;
};

