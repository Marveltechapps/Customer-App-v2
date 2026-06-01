import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import NetInfo from '@react-native-community/netinfo';
import NoInternetIcon from '../assets/images/no-internet-icon.svg';
import type { RootStackParamList } from '../types/navigation';
import { useNetwork } from '../contexts/NetworkContext';
import { logger } from '@/utils/logger';
import { getEnvConfigSafe } from '../config/env';

// Screen data
const SCREEN_DATA = {
  title: "You are offline",
  description: "You are not connected to the internet. please connect to the internet and try again",
  buttonText: "Reload",
};

interface NoInternetScreenProps {}

const NoInternet: React.FC<NoInternetScreenProps> = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isConnected, previousRoute } = useNetwork();
  const [isChecking, setIsChecking] = useState<boolean>(false);

  // Auto-navigate when connection is restored (handled by NetworkContext)
  // This effect is just for visual feedback
  useEffect(() => {
    if (isConnected) {
      // Connection restored - navigation is handled by NetworkContext
      // Just show a brief message or let NetworkContext handle it
    }
  }, [isConnected]);

  const navigateBack = () => {
    if (previousRoute) {
      (navigation.navigate as any)(previousRoute.name, previousRoute.params);
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Splash' }],
      });
    }
  };

  // Handle reload button press - check NetInfo and optionally verify with a real request (in case NetInfo is wrong)
  const handleReload = async () => {
    setIsChecking(true);

    try {
      // 1) Optional reachability check: if API responds, we have internet even if NetInfo says offline
      try {
        const { apiBaseUrl } = getEnvConfigSafe();
        const healthUrl = `${apiBaseUrl.replace(/\/+$/, '')}/health`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(healthUrl, { method: 'GET', signal: controller.signal, cache: 'no-store' });
        clearTimeout(timeoutId);
        if (res.ok || res.status === 401 || res.status === 404) {
          logger.info('Reachability check succeeded, navigating back');
          navigateBack();
          return;
        }
      } catch (_) {
        // Reachability failed; fall back to NetInfo
      }

      // 2) NetInfo
      if (!NetInfo || typeof NetInfo.fetch !== 'function') {
        logger.error('NetInfo native module is not available');
        alert('Network module not available. Please rebuild the app.');
        setIsChecking(false);
        return;
      }

      const state = await NetInfo.fetch();
      const connected = state.isConnected ?? false;

      if (connected) {
        navigateBack();
      } else {
        logger.info('Still offline');
      }
    } catch (error) {
      logger.error('Error checking connectivity', error);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Content Container */}
        <View style={styles.contentContainer}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <NoInternetIcon width={148} height={148} />
          </View>

          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{SCREEN_DATA.title}</Text>
          </View>

          {/* Description */}
          <View style={styles.descriptionContainer}>
            <Text style={styles.description}>{SCREEN_DATA.description}</Text>
          </View>

          {/* Reload Button */}
          <TouchableOpacity
            style={[styles.reloadButton, isChecking && styles.reloadButtonDisabled]}
            onPress={handleReload}
            disabled={isChecking}
            activeOpacity={0.8}
          >
            <Text style={styles.reloadButtonText} numberOfLines={1}>
              {isChecking ? 'Checking...' : SCREEN_DATA.buttonText}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 60,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 148,
    height: 148,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleContainer: {
    width: '100%',
    maxWidth: 324,
    paddingHorizontal: 109,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Inter',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20, // 1.4285714285714286em (14 * 1.428571)
    textAlign: 'center',
    color: '#1A1A1A',
  },
  descriptionContainer: {
    width: '100%',
    maxWidth: 325,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 16, // 1.3333333333333333em (12 * 1.333333)
    textAlign: 'center',
    color: '#6B6B6B',
  },
  reloadButton: {
    width: '100%',
    maxWidth: 325,
    backgroundColor: '#034703',
    borderRadius: 8,
    paddingVertical: 13,
    paddingHorizontal: 136,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  reloadButtonDisabled: {
    opacity: 0.6,
  },
  reloadButtonText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 22.4, // 1.5999999727521623em (14 * 1.5999999727521623)
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

export default NoInternet;

