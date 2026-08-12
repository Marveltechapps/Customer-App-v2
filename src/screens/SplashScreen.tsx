import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, StatusBar, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RootStackNavigationProp, RootStackRouteProp } from '../types/navigation';
import { APP_LAUNCH_ID, markSplashCompleted } from '../constants/appLaunch';
import Text from '../components/common/Text';
import { tokenManager } from '../services/api/tokenManager';
import * as storage from '../utils/storage';
import { logger } from '@/utils/logger';
import { useResponsive } from '@/utils/responsive';

import SplashLogo from '../assets/images/splash-logo.svg';

const SplashScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<RootStackRouteProp<'Splash'>>();
  const splashNext = route.params?.next;
  const { wp, scaleFont } = useResponsive();
  const logoSize = Math.min(wp(70), 340);
  const titleFontSize = scaleFont(24, 20, 30);
  const subtitleFontSize = scaleFont(16, 14, 20);
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;

  // Animation values
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(20)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    markSplashCompleted();

    // Logo animation - scale and fade in together (0-600ms)
    const logoAnimation = Animated.parallel([
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    // Title animation - starts at 300ms, completes at 900ms (600ms duration)
    const titleAnimation = Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 600,
        delay: 300,
        useNativeDriver: true,
      }),
      Animated.timing(titleTranslateY, {
        toValue: 0,
        duration: 600,
        delay: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    // Subtitle animation - starts at 600ms, completes at 1200ms (600ms duration)
    const subtitleAnimation = Animated.parallel([
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 600,
        delay: 600,
        useNativeDriver: true,
      }),
      Animated.timing(subtitleTranslateY, {
        toValue: 0,
        duration: 600,
        delay: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    logoAnimation.start();
    titleAnimation.start();
    subtitleAnimation.start();

    let cancelled = false;
    const navigationTimer = setTimeout(async () => {
      if (cancelled) return;
      const nav = navigationRef.current;
      try {
        await tokenManager.initialize();
        if (cancelled) return;
        if (tokenManager.isTokenValid()) {
          logger.info('Valid session found, navigating to MainTabs');
          nav.replace('MainTabs');
          return;
        }
        if (splashNext === 'Login') {
          logger.info('Splash complete, navigating to Login');
          nav.replace('Login', { fromSplash: APP_LAUNCH_ID });
          return;
        }
        const onboardingDone = await storage.getOnboardingCompleted();
        if (cancelled) return;
        if (onboardingDone) {
          logger.info('Onboarding completed without a valid session, navigating to Login');
          nav.replace('Login', { fromSplash: APP_LAUNCH_ID });
        } else {
          nav.replace('Onboarding');
        }
      } catch (err) {
        if (cancelled) return;
        logger.warn('Splash auth check failed; routing by onboarding flag', err);
        try {
          const onboardingDone = await storage.getOnboardingCompleted();
          if (cancelled) return;
          if (onboardingDone) {
            nav.replace('Login', { fromSplash: APP_LAUNCH_ID });
          } else {
            nav.replace('Onboarding');
          }
        } catch {
          nav.replace('Login', { fromSplash: APP_LAUNCH_ID });
        }
      }
    }, 2500);

    return () => {
      cancelled = true;
      clearTimeout(navigationTimer);
    };
    // Intentionally omit `navigation` — identity churn was resetting the 2.5s timer and looping splash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splashNext]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#034703" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          {/* Logo with animation */}
          <Animated.View
            style={[
              styles.logoContainer,
              {
                width: logoSize,
                height: logoSize,
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <SplashLogo width={logoSize} height={logoSize} />
          </Animated.View>

          {/* Text Content with animation */}
          <View style={styles.textContainer}>
            <Animated.View
              style={[
                styles.titleWrapper,
                {
                  opacity: titleOpacity,
                  transform: [{ translateY: titleTranslateY }],
                },
              ]}
            >
              <View style={styles.titleContainer}>
                <Text style={[styles.title, { fontSize: titleFontSize }]}>Avoid poison on your plate</Text>
              </View>
            </Animated.View>

            <Animated.View
              style={[
                styles.subtitleWrapper,
                {
                  opacity: subtitleOpacity,
                  transform: [{ translateY: subtitleTranslateY }],
                },
              ]}
            >
              <Text style={[styles.subtitle, { fontSize: subtitleFontSize }]}>
                India's first lab-tested organic grocery app
              </Text>
            </Animated.View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#034703',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 48,
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 8, // 8px gap between title and subtitle (as per Figma)
  },
  titleWrapper: {
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: '500',
    lineHeight: 32, // 1.3333333333333333em
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitleWrapper: {
    width: '100%',
    alignItems: 'stretch',
  },
  subtitle: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24, // 1.5em
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

export default SplashScreen;

