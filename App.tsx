/**
 * React Native App - Main Entry Point
 * 
 * This is the main entry point of the application.
 * Default screen: NoInternet (checks connectivity on startup)
 * 
 * Navigation Structure:
 * - NoInternet (main/default screen)
 *   - Shows when there's no internet connection
 *   - Reload button to check connectivity
 * - Login
 *   - Mobile number input
 *   - OTP verification flow
 * - Checkout
 *   - Empty cart state
 *   - Cart with products (no address)
 *   - Cart with products and address
 * - Order Status
 *   - Order Status Main
 *   - Order Status Details
 * - Settings
 *   - Orders
 *   - Customer Support & FAQ
 *   - Addresses
 *   - Refunds
 *   - Profile
 *   - Payment management
 *   - General Info
 *   - Notifications
 *
 * @format
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import type { RootStackParamList } from './src/types/navigation';
import AppNavigator from './src/navigation/AppNavigator';
import { CartProvider } from '@/contexts/CartContext';
import { NetworkProvider, useNetwork } from './src/contexts/NetworkContext';
import { UserProvider } from './src/contexts/UserContext';
import { LocationProvider } from './src/contexts/LocationContext';
import { HomeProvider } from './src/contexts/HomeContext';
import { AppConfigProvider } from './src/contexts/AppConfigContext';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import { setupGlobalErrorHandler } from './src/utils/errorHandler';
import { analytics } from './src/utils/analytics';
import { APP_LAUNCH_ID } from './src/constants/appLaunch';
import { ensureSplashOnLaunch, setNavigationRef as setGlobalNavRef } from './src/utils/navigationRef';
import { setupNotificationHandler } from './src/services/notifications/notificationService';
import Toast from 'react-native-toast-message';
import { logNativeModuleStatus } from './src/utils/nativeModuleCheck';
import { getEnvConfigSafe, DEFAULT_BACKEND_PORT } from './src/config/env';

SplashScreen.preventAutoHideAsync();

// Ensure foreground notifications show alerts (set early at app boot)
setupNotificationHandler();

// Sentry Error Tracking
// To enable Sentry error tracking:
// 1. Install: npm install @sentry/react-native
// 2. Add SENTRY_DSN to your .env file
// 3. Uncomment and configure the initialization below
//
// import * as Sentry from '@sentry/react-native';
// import { getEnvConfigSafe } from './src/config/env';
//
// const envConfig = getEnvConfigSafe();
// const sentryDsn = process.env.SENTRY_DSN;
//
// if (sentryDsn) {
//   Sentry.init({
//     dsn: sentryDsn,
//     environment: envConfig.env,
//     enableAutoSessionTracking: true,
//     tracesSampleRate: envConfig.env === 'production' ? 0.2 : 1.0,
//   });
// }

// Inner component that has access to NetworkContext
const AppContent: React.FC = () => {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList> | null>(null);
  const { setNavigationRef: setNetworkNavRef } = useNetwork();

  return (
    <ErrorBoundary
      fallback={
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5', padding: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: '600', color: '#1A1A1A', marginBottom: 12, textAlign: 'center' }}>
            Navigation Error
          </Text>
          <Text style={{ fontSize: 14, color: '#6B6B6B', textAlign: 'center', marginBottom: 24 }}>
            The app encountered an error in navigation. Please restart the app.
          </Text>
        </View>
      }
      onError={(error, errorInfo) => {
        console.error('Navigation error:', error, errorInfo);
      }}
    >
      <NavigationContainer
        key={APP_LAUNCH_ID}
        ref={(ref) => {
          const typed = ref as NavigationContainerRef<RootStackParamList> | null;
          navigationRef.current = typed;
          setNetworkNavRef(typed);
          setGlobalNavRef(typed);
        }}
        onReady={ensureSplashOnLaunch}
      >
        <ErrorBoundary
          fallback={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5', padding: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '600', color: '#1A1A1A', marginBottom: 12, textAlign: 'center' }}>
                App Navigator Error
              </Text>
              <Text style={{ fontSize: 14, color: '#6B6B6B', textAlign: 'center' }}>
                An error occurred in the app navigator. Please restart the app.
              </Text>
            </View>
          }
        >
          <AppNavigator />
        </ErrorBoundary>
      </NavigationContainer>
    </ErrorBoundary>
  );
};

function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter: Inter_400Regular,
    'Inter-Regular': Inter_400Regular,
    Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    Inter_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        console.warn('Failed to hide splash screen:', e);
      }
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    setupGlobalErrorHandler();
    logNativeModuleStatus();
    analytics.trackScreenView('App');

    if (__DEV__) {
      const { apiBaseUrl } = getEnvConfigSafe();
      const healthUrl = `${apiBaseUrl.replace(/\/+$/, '')}/health`;
      fetch(healthUrl, { method: 'GET', cache: 'no-store' })
        .then((res) => {
          if (res.ok) {
            console.info('[dev] Customer backend reachable at', apiBaseUrl);
            return;
          }
          console.warn(
            `[dev] Backend responded ${res.status} at ${healthUrl}. Expected port ${DEFAULT_BACKEND_PORT}.`
          );
        })
        .catch(() => {
          console.warn(
            `[dev] Cannot reach customer backend at ${apiBaseUrl}. ` +
              `Start selorg-backend (npm run dev). If you see "Port already in use", reload Expo — backend may already be running.`
          );
        });
    }

    // Aggressive fallback: Hide splash ASAP regardless of font loading
    // This prevents the white screen issue if font loading is slow
    const timer = setTimeout(async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        // Already hidden or app closed
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // Don't block rendering on fonts - show app content even if fonts are still loading
  // Fonts will be used when ready, but we won't show a blank white screen
  if (fontError) {
    // Only block if there's an actual font error (not just loading)
    return (
      <View style={appStyles.errorContainer}>
        <Text style={appStyles.errorText}>Failed to load fonts. Please restart the app.</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <SafeAreaProvider>
          <NetworkProvider>
            <AppConfigProvider>
              <UserProvider>
                <LocationProvider>
                  <CartProvider>
                    <HomeProvider>
                      <AppContent />
                    </HomeProvider>
                  </CartProvider>
                </LocationProvider>
              </UserProvider>
            </AppConfigProvider>
          </NetworkProvider>
        </SafeAreaProvider>
        <Toast />
      </View>
    </ErrorBoundary>
  );
}

const appStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#034703',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#1A1A1A',
    textAlign: 'center',
  },
});

export default App;
