import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, StatusBar, Animated, Easing, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RootStackNavigationProp, RootStackRouteProp } from '../types/navigation';
import { APP_LAUNCH_ID } from '../constants/appLaunch';
import Text from '../components/common/Text';
import { tokenManager } from '../services/api/tokenManager';
import * as storage from '../utils/storage';
import { logger } from '@/utils/logger';

const splashLogo = require('../../assets/selorg-logo.png');

const SplashScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<RootStackRouteProp<'Splash'>>();
  const splashNext = route.params?.next;
  
  // Animation values
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(20)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
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

    // Start all animations
    logoAnimation.start();
    titleAnimation.start();
    subtitleAnimation.start();

    const navigationTimer = setTimeout(async () => {
      try {
        await tokenManager.initialize();
        if (tokenManager.isTokenValid()) {
          logger.info('Valid session found, navigating to MainTabs');
          navigation.replace('MainTabs');
          return;
        }
        if (splashNext === 'Login') {
          logger.info('Splash complete, navigating to Login');
          navigation.replace('Login', { fromSplash: APP_LAUNCH_ID });
          return;
        }
        const onboardingDone = await storage.getOnboardingCompleted();
        if (onboardingDone) {
          logger.info('Onboarding completed without a valid session, navigating to Login');
          navigation.replace('Login', { fromSplash: APP_LAUNCH_ID });
        } else {
          navigation.replace('Onboarding');
        }
      } catch (err) {
        logger.warn('Splash auth check failed, defaulting to Onboarding', err);
        navigation.replace('Onboarding');
      }
    }, 2500);

    return () => {
      clearTimeout(navigationTimer);
    };
  }, [navigation, splashNext]);

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
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <Image source={splashLogo} style={styles.logo} resizeMode="contain" />
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
                <Text style={styles.title}>Avoid poison on your plate</Text>
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
              <Text style={styles.subtitle}>
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
    width: 300,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 300,
    height: 300,
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

