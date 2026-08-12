/**
 * Expo App Configuration
 * 
 * This file replaces app.json and provides dynamic configuration
 * including environment variables and native module plugins.
 */

const path = require('path');
const fs = require('fs');
const withPaynimoActivity = require('./plugins/withPaynimoActivity.js');
const withFirebaseMessagingManifestFix = require('./plugins/withFirebaseMessagingManifestFix.js');

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

/**
 * Firebase client config (JS SDK) — env only, no hardcoded secrets.
 * Prefer EXPO_PUBLIC_* (inlined for Metro) with FIREBASE_* aliases for EAS secrets.
 * Set the same names as EAS Secrets for development / preview / production builds.
 */
function envFirst(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

const FIREBASE_API_KEY = envFirst('EXPO_PUBLIC_FIREBASE_API_KEY', 'FIREBASE_API_KEY');
const FIREBASE_AUTH_DOMAIN = envFirst('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', 'FIREBASE_AUTH_DOMAIN');
const FIREBASE_PROJECT_ID = envFirst('EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID');
const FIREBASE_STORAGE_BUCKET = envFirst('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', 'FIREBASE_STORAGE_BUCKET');
const FIREBASE_MESSAGING_SENDER_ID = envFirst(
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_MESSAGING_SENDER_ID'
);
const FIREBASE_APP_ID = envFirst('EXPO_PUBLIC_FIREBASE_APP_ID', 'FIREBASE_APP_ID');
const FIREBASE_APP_ID_ANDROID = envFirst(
  'EXPO_PUBLIC_FIREBASE_APP_ID_ANDROID',
  'FIREBASE_APP_ID_ANDROID'
);
const FIREBASE_APP_ID_IOS = envFirst('EXPO_PUBLIC_FIREBASE_APP_ID_IOS', 'FIREBASE_APP_ID_IOS');
const FIREBASE_MEASUREMENT_ID = envFirst(
  'EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID',
  'FIREBASE_MEASUREMENT_ID'
);

// Mirror into EXPO_PUBLIC_* so Metro can inline them when present only as FIREBASE_*.
const firebasePublicMirror = {
  EXPO_PUBLIC_FIREBASE_API_KEY: FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: FIREBASE_STORAGE_BUCKET,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: FIREBASE_MESSAGING_SENDER_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID: FIREBASE_APP_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID_ANDROID: FIREBASE_APP_ID_ANDROID,
  EXPO_PUBLIC_FIREBASE_APP_ID_IOS: FIREBASE_APP_ID_IOS,
  EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID: FIREBASE_MEASUREMENT_ID,
};
Object.entries(firebasePublicMirror).forEach(([key, value]) => {
  if (value && !process.env[key]) process.env[key] = value;
});

const firebaseClientConfig = {
  apiKey: FIREBASE_API_KEY,
  authDomain: FIREBASE_AUTH_DOMAIN,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  appId: FIREBASE_APP_ID,
  appIdAndroid: FIREBASE_APP_ID_ANDROID,
  appIdIos: FIREBASE_APP_ID_IOS,
  measurementId: FIREBASE_MEASUREMENT_ID,
};

const firebaseRequiredKeys = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
];
const firebaseMissing = firebaseRequiredKeys.filter((k) => !firebaseClientConfig[k]);
const hasPlatformAppId =
  Boolean(firebaseClientConfig.appId) ||
  Boolean(firebaseClientConfig.appIdAndroid) ||
  Boolean(firebaseClientConfig.appIdIos);
if (firebaseMissing.length > 0 || !hasPlatformAppId) {
  console.warn(
    '⚠️  Firebase client env incomplete. Set FIREBASE_* / EXPO_PUBLIC_FIREBASE_* (see .env.example). JS Firebase will stay disabled until configured.'
  );
}

const ANDROID_PACKAGE = 'com.selorg.com';
const IOS_BUNDLE_ID = 'com.selorg.com';

/** Validate Android google-services.json for EAS / prebuild FCM. */
function resolveAndroidGoogleServicesFile() {
  const relativePath = './google-services.json';
  const absolutePath = path.resolve(__dirname, 'google-services.json');
  if (!fs.existsSync(absolutePath)) {
    console.warn(
      '⚠️  google-services.json missing at Customer-App-v2 root. Android FCM / native Firebase will not work in release builds.'
    );
    return undefined;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    const clients = Array.isArray(parsed.client) ? parsed.client : [];
    const packageNames = clients
      .map((c) => c?.client_info?.android_client_info?.package_name)
      .filter(Boolean);
    if (!packageNames.includes(ANDROID_PACKAGE)) {
      console.warn(
        `⚠️  google-services.json package_name mismatch. Expected "${ANDROID_PACKAGE}", found: ${
          packageNames.join(', ') || '(none)'
        }`
      );
    } else {
      console.log(`✅ google-services.json OK for Android package ${ANDROID_PACKAGE}`);
    }
  } catch (error) {
    console.warn('⚠️  Failed to parse google-services.json:', error?.message || error);
  }
  return relativePath;
}

/** iOS native Firebase / FCM config (GoogleService-Info.plist at app root). */
function resolveIosGoogleServicesFile() {
  const relativePath = './GoogleService-Info.plist';
  const absolutePath = path.resolve(__dirname, 'GoogleService-Info.plist');
  if (!fs.existsSync(absolutePath)) {
    console.warn(
      '⚠️  GoogleService-Info.plist not found. iOS native FCM requires this file + ios.googleServicesFile.'
    );
    return undefined;
  }
  try {
    const contents = fs.readFileSync(absolutePath, 'utf8');
    const plistValue = (key) => {
      const match = contents.match(
        new RegExp(`<key>${key}<\\/key>\\s*<string>([^<]+)<\\/string>`)
      );
      return match?.[1]?.trim() || '';
    };
    const plistBundleId = plistValue('BUNDLE_ID');
    const googleAppId = plistValue('GOOGLE_APP_ID');
    const gcmSenderId = plistValue('GCM_SENDER_ID');
    const projectId = plistValue('PROJECT_ID');
    const gcmEnabled =
      /<key>IS_GCM_ENABLED<\/key>\s*<true\s*\/>/i.test(contents) ||
      /<key>IS_GCM_ENABLED<\/key>\s*<true>\s*<\/true>/i.test(contents);

    if (plistBundleId && plistBundleId !== IOS_BUNDLE_ID) {
      console.warn(
        `⚠️  GoogleService-Info.plist BUNDLE_ID mismatch. Expected "${IOS_BUNDLE_ID}", found: "${plistBundleId}"`
      );
    } else if (plistBundleId) {
      console.log(`✅ GoogleService-Info.plist OK for iOS bundle ${IOS_BUNDLE_ID}`);
    } else {
      console.warn('⚠️  GoogleService-Info.plist found but BUNDLE_ID could not be parsed.');
    }

    if (!googleAppId || !googleAppId.includes(':ios:')) {
      console.warn('⚠️  GoogleService-Info.plist GOOGLE_APP_ID missing or not an iOS app id.');
    }
    if (!gcmSenderId) {
      console.warn('⚠️  GoogleService-Info.plist GCM_SENDER_ID missing (required for FCM).');
    }
    if (!projectId) {
      console.warn('⚠️  GoogleService-Info.plist PROJECT_ID missing.');
    }
    if (!gcmEnabled) {
      console.warn('⚠️  GoogleService-Info.plist IS_GCM_ENABLED is not true.');
    }
  } catch (error) {
    console.warn('⚠️  Failed to parse GoogleService-Info.plist:', error?.message || error);
  }
  return relativePath;
}

const androidGoogleServicesFile = resolveAndroidGoogleServicesFile();
const iosGoogleServicesFile = resolveIosGoogleServicesFile();

/**
 * aps-environment must be `production` for TestFlight / App Store / preview release builds.
 * Dev-client only uses `development` (EAS_BUILD_PROFILE=development or APS_ENVIRONMENT override).
 */
const easBuildProfile = String(process.env.EAS_BUILD_PROFILE || '').trim();
const apsEnvironmentOverride = String(process.env.APS_ENVIRONMENT || '').trim().toLowerCase();
const apsEnvironment =
  apsEnvironmentOverride === 'development' || apsEnvironmentOverride === 'production'
    ? apsEnvironmentOverride
    : easBuildProfile === 'development'
      ? 'development'
      : 'production';

/** Apple Developer Team ID — EAS signing + APNs Auth Key Team ID in Firebase Console. */
const APPLE_TEAM_ID = String(process.env.APPLE_TEAM_ID || '387A8ZCB5C').trim();

/** APNs Auth Key ID uploaded in Firebase Console → Cloud Messaging (Apple). */
const APNS_KEY_ID = String(process.env.APNS_KEY_ID || '2HVKPR57YW').trim();

console.log(
  `✅ iOS aps-environment=${apsEnvironment} (profile=${easBuildProfile || 'local'}, team=${APPLE_TEAM_ID}, apnsKey=${APNS_KEY_ID})`
);

// Root assets for native icons and splash branding.
// Expo Go / native splash require PNG (SVG is invalid for icon/splash).
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
      bundleIdentifier: IOS_BUNDLE_ID,
      appleTeamId: APPLE_TEAM_ID,
      ...(iosGoogleServicesFile ? { googleServicesFile: iosGoogleServicesFile } : {}),
      entitlements: {
        'aps-environment': apsEnvironment,
      },
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
        UIBackgroundModes: ['remote-notification'],
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: appIcon,
        backgroundColor: "#ffffff"
      },
      package: ANDROID_PACKAGE,
      ...(androidGoogleServicesFile ? { googleServicesFile: androidGoogleServicesFile } : {}),
      config: {
        ...(GOOGLE_MAPS_API_KEY && {
          googleMaps: {
            apiKey: GOOGLE_MAPS_API_KEY
          }
        })
      },
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "POST_NOTIFICATIONS",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE"
      ]
    },
    web: {
      favicon: appIcon
    },
    plugins: [
      "@react-native-firebase/app",
      "@react-native-firebase/messaging",
      [
        "expo-build-properties",
        {
          // Expo SDK 54 / RN 0.81 floor is iOS 15.1 (15.0 is rejected by expo-build-properties).
          ios: {
            deploymentTarget: "15.1",
            newArchEnabled: false,
            // Required by firebase-ios-sdk / React Native Firebase on Expo 54+.
            useFrameworks: "static",
            forceStaticLinking: ["RNFBApp", "RNFBMessaging"],
          },
          android: {
            newArchEnabled: true,
            minSdkVersion: 24,
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            buildToolsVersion: "36.0.0",
            usesCleartextTraffic: true
          }
        }
      ],
      [
        "expo-notifications",
        {
          icon: appIcon,
          color: "#034703",
          // Adds UIBackgroundModes → remote-notification for iOS background/killed delivery.
          enableBackgroundRemoteNotifications: true,
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
      withPaynimoActivity,
      // Must run after expo-notifications so tools:replace is applied to the color meta-data it adds.
      withFirebaseMessagingManifestFix
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
      ...(GOOGLE_MAPS_API_KEY && { googleMapsApiKey: GOOGLE_MAPS_API_KEY }),
      /** JS Firebase SDK config (from env). Consumed by src/config/firebase.ts */
      firebase: firebaseClientConfig,
      /** Native FCM file linkage status for runtime diagnostics (no secrets). */
      firebaseNative: {
        androidGoogleServicesFile: androidGoogleServicesFile || null,
        iosGoogleServicesFile: iosGoogleServicesFile || null,
      },
      /** APNs Auth Key metadata (no private key). Must match Firebase Console upload. */
      apns: {
        keyId: APNS_KEY_ID,
        teamId: APPLE_TEAM_ID,
        bundleId: IOS_BUNDLE_ID,
        apsEnvironment,
      },
    }
  }
};

