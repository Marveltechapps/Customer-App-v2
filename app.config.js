/**
 * Expo App Configuration
 * 
 * This file replaces app.json and provides dynamic configuration
 * including environment variables and native module plugins.
 */

const path = require('path');
const fs = require('fs');
const withPaynimoActivity = require('./plugins/withPaynimoActivity.js');

const envPath = path.resolve(__dirname, '.env');

// Backend port (match selorg-dashboard-backend `PORT`). Avoid 5000 (macOS AirPlay) and 5554–5585 (Android emulator ADB/console).
const DEFAULT_BACKEND_PORT = 3333;
const DEFAULT_DEV_API_BASE_URL = `http://localhost:${DEFAULT_BACKEND_PORT}/api/v1/customer`;
const HOSTED_API_BASE_URL = 'https://api.selorg.com/api/v1/customer';
const HOSTED_PAYMENT_API_BASE_URL = 'https://api.selorg.com';
const TUNNEL_API_BASE_URL =
  process.env.TUNNEL_API_BASE_URL ||
  process.env.EXPO_PUBLIC_TUNNEL_API_BASE_URL ||
  '';
const TUNNEL_PAYMENT_API_BASE_URL =
  process.env.TUNNEL_PAYMENT_API_BASE_URL ||
  process.env.EXPO_PUBLIC_TUNNEL_PAYMENT_API_BASE_URL ||
  '';

// Load .env from project root so ENV and API_BASE_URL are set regardless of cwd
try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
  } else {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      require('dotenv').config({ path: envPath });
    } catch {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex === -1) return;
        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim();
        if (key && process.env[key] === undefined) {
          process.env[key] = value;
        }
      });
    }
  }
} catch (e) {
  // ignore
}

/**
 * MODE is the source of truth for backend selection.
 * - MODE=dev  -> local backend (localhost:3333 by default; set API_BASE_URL to override)
 * - MODE=prod -> hosted backend (api.selorg.com)
 * - unset     -> hosted backend by default
 *
 * Back-compat: ENV may still be present; we map MODE -> env so existing runtime
 * logic continues to work. API_BASE_URL remains an explicit override.
 */
function normalizeMode(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'prod' || v === 'production') return 'prod';
  if (v === 'dev' || v === 'development') return 'dev';
  return 'prod';
}

function modeToEnv(mode) {
  return mode === 'prod' ? 'production' : 'development';
}

/**
 * Prefer `MODE` over `mode`. EAS Build sets `MODE` from eas.json; a local `.env` often
 * uses lowercase `mode=dev`. If we read `mode` first, dev wins and release/APK/IPA
 * builds incorrectly talk to LAN/local URLs ("Check your connection" on Pay now).
 */
const rawMode = process.env.MODE ?? process.env.mode;
const isEasBuild = process.env.EAS_BUILD === 'true';
const easProfile = String(process.env.EAS_BUILD_PROFILE || '').trim().toLowerCase();
/** Preview/production EAS profiles should use hosted API unless explicitly overridden. */
const easHostedProfile =
  isEasBuild && (easProfile === 'production' || easProfile === 'preview');
let resolvedMode = normalizeMode(rawMode);
if (easHostedProfile) {
  resolvedMode = 'prod';
}

/** Same host as production API; `/api/payment/callback` etc. EAS: set PAYMENT_API_BASE_URL to override. */
const resolvedPaymentApiBaseUrl =
  process.env.PAYMENT_API_BASE_URL ||
  (resolvedMode === 'prod' ? HOSTED_PAYMENT_API_BASE_URL : `http://localhost:${DEFAULT_BACKEND_PORT}`);

// Validate required environment variables
const GOOGLE_MAPS_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
if (GOOGLE_MAPS_API_KEY && !process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) {
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = GOOGLE_MAPS_API_KEY;
}
if (!GOOGLE_MAPS_API_KEY) {
  console.warn('⚠️  GOOGLE_MAPS_API_KEY not set. Maps features will be disabled.');
  // Continue with build but maps features will not work
}

// Root assets for native icons and splash branding.
const appIcon = "./assets/selorg-logo.png";
const splashImage = "./assets/splash.png";

module.exports = {
  expo: {
    name: "Selorg",
    slug: "frontend",
    version: "0.0.2",
    jsEngine: "hermes",
    orientation: "portrait",
    icon: appIcon,
    userInterfaceStyle: "light",
    splash: {
      image: splashImage,
      resizeMode: "contain",
      backgroundColor: "#034703"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    updates: {
      enabled: false,
      checkAutomatically: "NEVER"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.selorg.mobile",
      config: {
        ...(GOOGLE_MAPS_API_KEY && { googleMapsApiKey: GOOGLE_MAPS_API_KEY })
      },
      infoPlist: {
        // RN RCTStatusBarManager (StatusBar.setBarStyle, etc.) requires NO; YES crashes at runtime.
        UIViewControllerBasedStatusBarAppearance: false,
        NSLocationWhenInUseUsageDescription: "This app needs access to your location to show the route to your delivery address.",
        NSLocationAlwaysUsageDescription: "This app needs access to your location to show the route to your delivery address.",
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
          NSAllowsLocalNetworking: true
        },
        LSApplicationQueriesSchemes: ['phonepe', 'gpay', 'paytm', 'credpay'],
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: appIcon,
        backgroundColor: "#ffffff"
      },
      package: "com.selorg.mobile",
      config: {
        ...(GOOGLE_MAPS_API_KEY && {
          googleMaps: {
            apiKey: GOOGLE_MAPS_API_KEY
          }
        })
      },
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION"
      ]
    },
    web: {
      favicon: appIcon
    },
    plugins: [
      [
        "expo-build-properties",
        {
          ios: {
            newArchEnabled: false
          },
          android: {
            newArchEnabled: false,
            minSdkVersion: 24,
            // Match android/gradle.properties — avoids sideload failures on devices that reject target API 36.
            targetSdkVersion: 35,
            usesCleartextTraffic: true
          }
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/selorg-logo.png",
          color: "#034703"
        }
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "This app needs access to your location to show the route to your delivery address."
        }
      ],
      [
        "expo-video",
        {
          supportsBackgroundPlayback: false,
          supportsPictureInPicture: false
        }
      ],
      "expo-secure-store",
      withPaynimoActivity
    ],
    extra: {
      eas: {
        projectId: process.env.EAS_PROJECT_ID || ""
      },
      // mode controls backend selection. API_BASE_URL can still override explicitly.
      // Prefer `MODE` over `mode` (see rawMode above) so EAS profiles beat `.env`.
      mode: resolvedMode,
      env: modeToEnv(resolvedMode),
      apiBaseUrl:
        process.env.API_BASE_URL ||
        (resolvedMode === "prod" ? HOSTED_API_BASE_URL : DEFAULT_DEV_API_BASE_URL),
      // When Expo Go runs in Tunnel mode (host like *.exp.direct), localhost:3333 is NOT reachable from the phone.
      // Provide a public HTTPS tunnel that forwards to your local backend (e.g. ngrok/cloudflared).
      tunnelApiBaseUrl: TUNNEL_API_BASE_URL,
      // Base origin for `/api/payment/*` when tunneling (optional; if omitted we derive from tunnelApiBaseUrl origin).
      tunnelPaymentApiBaseUrl: TUNNEL_PAYMENT_API_BASE_URL,
      apiVersion: process.env.API_VERSION || "/api/v1",
      enableLogging: process.env.ENABLE_LOGGING !== "false",
      enableAnalytics: process.env.ENABLE_ANALYTICS !== "false",
      paymentApiBaseUrl: resolvedPaymentApiBaseUrl,
      /** `gateway`: delay → Worldline SDK → POST /api/payment/callback. `simulate`: delay → POST minimal body (mock servers only). */
      paymentStandaloneMode: (process.env.PAYMENT_STANDALONE_MODE || "gateway").trim().toLowerCase(),
      ...(GOOGLE_MAPS_API_KEY && { googleMapsApiKey: GOOGLE_MAPS_API_KEY })
    }
  }
};

