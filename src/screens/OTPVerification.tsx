import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Header from '../components/layout/Header';
import OTPIconContainer from '../assets/images/otp-icon-container.svg';
import type { RootStackParamList } from '../types/navigation';
import { verifyOtp, resendLoginOtp, getChannelLabel } from '../services/auth/authService';
import { tokenManager } from '../services/api/tokenManager';
import { useDimensions, scale, scaleFont, getSpacing, getBorderRadius, wp } from '../utils/responsive';
import { logger } from '@/utils/logger';
import { getApiErrorMessage } from '../services/api/types';
import { addressService } from '../services/address/addressService';
import { AuthLayout } from '@/constants/authTheme';
import { loadPendingOtpSession, clearPendingOtpSession } from '@/utils/pendingOtpSession';
import type { LoginMode } from '@/services/auth/authService';
import { APP_LAUNCH_ID } from '@/constants/appLaunch';

type OTPVerificationRouteProp = RouteProp<RootStackParamList, 'OTPVerification'>;

interface OTPVerificationScreenProps {}

const OTPVerification: React.FC<OTPVerificationScreenProps> = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<OTPVerificationRouteProp>();
  const routeParams = route.params ?? { phoneNumber: '' };

  const [sessionMeta, setSessionMeta] = useState({
    displayTarget: routeParams.displayTarget || routeParams.phoneNumber || '',
    sessionId: routeParams.sessionId as string | undefined,
    loginMode: (routeParams.loginMode || 'mobile') as LoginMode,
    otpTarget: routeParams.otpTarget || 'phone',
    countryCode: routeParams.countryCode || '+91',
    phone: routeParams.phone || '',
    email: routeParams.email || '',
    channel: routeParams.channel || 'sms',
  });

  const { width } = useDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let mounted = true;
    loadPendingOtpSession().then((stored) => {
      if (!mounted || !stored) return;
      setSessionMeta((prev) => ({
        displayTarget: stored.displayTarget || prev.displayTarget,
        sessionId: stored.sessionId || prev.sessionId,
        loginMode: stored.loginMode || prev.loginMode,
        otpTarget: stored.otpTarget || prev.otpTarget,
        countryCode: stored.countryCode || prev.countryCode,
        phone: stored.phone || prev.phone,
        email: stored.email || prev.email,
        channel: stored.channel || prev.channel,
      }));
    });
    return () => {
      mounted = false;
    };
  }, []);

  const channelLabel = getChannelLabel(sessionMeta.channel, sessionMeta.loginMode);
  const smsFallbackHint =
    sessionMeta.loginMode === 'whatsapp' && String(sessionMeta.channel).toLowerCase().includes('sms')
      ? ' (sent via SMS fallback)'
      : '';
  
  const [otp, setOtp] = useState<string[]>(['', '', '', '']);
  const [timer, setTimer] = useState<number>(AuthLayout.resendCooldownSec);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedInputIndex, setFocusedInputIndex] = useState<number | null>(null);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isScreenFocusedRef = useRef<boolean>(true);
  
  // Responsive styles memoized
  const responsiveStyles = useMemo(() => ({
    iconContainer: {
      gap: getSpacing(16),
    },
    iconSize: scale(56),
    contentContainer: {
      paddingVertical: getSpacing(20),
      paddingHorizontal: getSpacing(16),
    },
    contentWrapper: {
      maxWidth: scale(339),
      gap: getSpacing(24),
    },
    textContainer: {
      gap: getSpacing(8),
    },
    headingContainer: {
      paddingHorizontal: wp(12.27), // Responsive instead of 46px
    },
    heading: {
      fontSize: scaleFont(22, 20, 24),
      lineHeight: scaleFont(30, 28, 34),
    },
    paragraphContainer: {
      paddingHorizontal: wp(23.73), // Responsive instead of 89px
    },
    paragraph: {
      fontSize: scaleFont(12, 11, 14),
      lineHeight: scaleFont(18, 16, 20),
    },
    phoneTimerContainer: {
      gap: getSpacing(8),
      marginBottom: getSpacing(24), // Gap between timer and OTP inputs
    },
    phoneContainer: {
      height: scale(17.5),
    },
    phoneNumber: {
      fontSize: scaleFont(12, 11, 14),
      lineHeight: scaleFont(18, 16, 20),
    },
    timerContainer: {
      height: scale(17.5),
    },
    timerText: {
      fontSize: scaleFont(12, 11, 14),
      lineHeight: scaleFont(18, 16, 20),
    },
    otpContainer: {
      gap: getSpacing(8),
    },
    otpInput: {
      maxWidth: scale(56),
      minWidth: scale(56),
      minHeight: scale(56),
      borderRadius: getBorderRadius(8),
    },
    otpInputText: {
      fontSize: scaleFont(16, 14, 18),
    },
    errorText: {
      fontSize: scaleFont(12, 11, 14),
      lineHeight: scaleFont(16, 14, 18),
      marginTop: getSpacing(4),
    },
    actionContainer: {
      paddingVertical: getSpacing(24),
      paddingHorizontal: getSpacing(16),
      gap: getSpacing(14),
    },
    verifyButton: {
      borderRadius: getBorderRadius(8),
      paddingVertical: getSpacing(13),
      paddingHorizontal: wp(29.6), // Responsive instead of 111px
    },
    verifyButtonText: {
      fontSize: scaleFont(14, 12, 16),
      lineHeight: scaleFont(22.4, 20, 24),
    },
  }), [width]);

  // Animation values for icon fade-in
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.95)).current;

  // Animation values for text content
  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(15)).current;
  const paragraphOpacity = useRef(new Animated.Value(0)).current;
  const paragraphTranslateY = useRef(new Animated.Value(15)).current;

  // Animation values for OTP inputs (staggered)
  const otpInputOpacities = useRef(
    Array(4).fill(0).map(() => new Animated.Value(0))
  ).current;
  const otpInputTranslateYs = useRef(
    Array(4).fill(0).map(() => new Animated.Value(15))
  ).current;

  // Animation values for input focus
  const inputBorderColors = useRef(
    Array(4).fill(0).map(() => new Animated.Value(0))
  ).current;
  const inputScales = useRef(
    Array(4).fill(0).map(() => new Animated.Value(1))
  ).current;

  // Animation values for error message
  const errorOpacity = useRef(new Animated.Value(0)).current;
  const errorTranslateY = useRef(new Animated.Value(-20)).current;

  // Auth guard: if already logged in with valid token, stay in app
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        await tokenManager.initialize();
        if (mounted && tokenManager.isTokenValid()) {
          navigation.replace('MainTabs');
        }
      } catch {
        // ignore
      }
    };
    check();
    return () => { mounted = false; };
  }, [navigation]);

  // Animations on mount
  useEffect(() => {
    // Icon animation
    Animated.parallel([
      Animated.timing(iconOpacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(iconScale, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Heading animation - starts after icon (100ms delay)
    Animated.parallel([
      Animated.timing(headingOpacity, {
        toValue: 1,
        duration: 400,
        delay: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(headingTranslateY, {
        toValue: 0,
        duration: 400,
        delay: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Paragraph animation - starts after heading (200ms delay)
    Animated.parallel([
      Animated.timing(paragraphOpacity, {
        toValue: 1,
        duration: 400,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(paragraphTranslateY, {
        toValue: 0,
        duration: 400,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // OTP inputs animation - staggered (starts at 300ms)
    otpInputOpacities.forEach((opacity, index) => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          delay: 300 + (index * 50), // Stagger by 50ms each
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(otpInputTranslateYs[index], {
          toValue: 0,
          duration: 400,
          delay: 300 + (index * 50),
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, []);

  // Input focus animations
  useEffect(() => {
    inputScales.forEach((scale, index) => {
      const isFocused = focusedInputIndex === index;
      Animated.parallel([
        Animated.timing(scale, {
          toValue: isFocused ? 1.02 : 1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(inputBorderColors[index], {
          toValue: isFocused ? 1 : 0,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false, // Color animation requires false
        }),
      ]).start();
    });
  }, [focusedInputIndex]);

  // Error message animation
  useEffect(() => {
    if (error) {
      // Slide down and fade in
      Animated.parallel([
        Animated.timing(errorOpacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(errorTranslateY, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset when error is cleared
      errorOpacity.setValue(0);
      errorTranslateY.setValue(-20);
    }
  }, [error]);

  // Timer countdown - only runs when screen is focused
  useEffect(() => {
    // Clear any existing interval
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Only start timer if screen is focused and timer > 0
    if (isScreenFocusedRef.current && timer > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            // Clear interval when timer reaches 0
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    // Cleanup on unmount or when timer/dependencies change
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [timer]);

  // Handle screen focus/blur to pause/resume timer
  useFocusEffect(
    useCallback(() => {
      // Screen is focused
      isScreenFocusedRef.current = true;
      
      // Resume timer if it was running
      if (timer > 0 && !timerIntervalRef.current) {
        timerIntervalRef.current = setInterval(() => {
          setTimer(prev => {
            if (prev <= 1) {
              if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
              }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }

      // Cleanup when screen loses focus
      return () => {
        isScreenFocusedRef.current = false;
        // Clear timer interval when screen loses focus
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      };
    }, [timer])
  );

  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOtpChange = (value: string, index: number) => {
    const digit = value.replace(/[^0-9]/g, '');
    
    if (digit.length > 1) {
      // Handle paste or autofill: fill from index 0 if full OTP length
      const startIndex = digit.length >= 4 ? 0 : index;
      const digits = digit.slice(0, 4).split('');
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (startIndex + i < 4) {
          newOtp[startIndex + i] = d;
        }
      });
      setOtp(newOtp);
      setError(null);
      
      const nextEmptyIndex = newOtp.findIndex((val, i) => i >= startIndex && val === '');
      const focusIndex = nextEmptyIndex === -1 ? 3 : nextEmptyIndex;
      inputRefs.current[focusIndex]?.focus();

      // Auto-verify if all 4 digits are filled
      if (newOtp.every(d => d !== '')) {
        setTimeout(() => {
          inputRefs.current[3]?.blur();
        }, 100);
      }
    } else {
      const newOtp = [...otp];
      newOtp[index] = digit;
      setOtp(newOtp);
      setError(null);

      if (digit && index < 3) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmitEditing = () => {
    // When "done" / tick is pressed on keyboard, dismiss keyboard
    inputRefs.current.forEach(ref => ref?.blur());
  };

  const isOtpComplete = otp.every(digit => digit !== '');

  const handleVerifyAndContinue = async () => {
    if (!isOtpComplete) {
      setError('Please enter all 4 digits');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const otpCode = otp.join('');

      logger.info('Verifying OTP', {
        otpCode,
        displayTarget: sessionMeta.displayTarget,
        sessionId: sessionMeta.sessionId,
      });

      const resp = await verifyOtp(sessionMeta.sessionId || '', otpCode);

      if (resp && resp.data && resp.data.accessToken) {
        logger.info('OTP verified successfully, navigating to main app');
        try {
          const addrRes = await addressService.getAll();
          if (addrRes?.success && addrRes.data && addrRes.data.length > 0) {
            navigation.replace('MainTabs');
          } else {
            navigation.replace('LocationPermission', { fromAuth: true });
          }
        } catch {
          navigation.replace('LocationPermission', { fromAuth: true });
        }
      } else {
        setError((resp as any)?.message || 'Invalid OTP. Please try again.');
      }
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to verify OTP. Please try again.');
      logger.error('Verify OTP failed', { message: msg });
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (timer > 0 || !sessionMeta.sessionId) return;

    setLoading(true);
    setError(null);

    try {
      logger.info('Resending OTP', { sessionId: sessionMeta.sessionId });
      const resp = await resendLoginOtp(sessionMeta.sessionId, sessionMeta.loginMode);
      const cooldown =
        (resp as { resendCooldownSeconds?: number }).resendCooldownSeconds ??
        resp.data?.resendCooldownSeconds ??
        AuthLayout.resendCooldownSec;
      setTimer(cooldown);
      setOtp(['', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to resend OTP. Please try again.');
      logger.error('Resend OTP failed', { message: msg });
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeContact = async () => {
    await clearPendingOtpSession();
    navigation.replace('Login', {
      fromSplash: routeParams.fromSplash ?? APP_LAUNCH_ID,
      loginMode: sessionMeta.loginMode,
      email: sessionMeta.email || undefined,
      phone: sessionMeta.phone || undefined,
      countryCode: sessionMeta.countryCode || undefined,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.body}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
          enabled={Platform.OS === 'ios'}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: getSpacing(20) }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            bounces={false}
          >
            {/* Header */}
            <Header title="Verify OTP" />

            {/* Content Container */}
            <View style={styles.contentContainer}>
              <View style={styles.contentWrapper}>
                {/* Icon Container - Animated */}
                <Animated.View
                  style={[
                    styles.iconContainer,
                    responsiveStyles.iconContainer,
                    {
                      opacity: iconOpacity,
                      transform: [{ scale: iconScale }],
                    },
                  ]}
                >
                  <OTPIconContainer width={responsiveStyles.iconSize} height={responsiveStyles.iconSize} />
                </Animated.View>

                {/* Text Content - Animated */}
                <View style={[styles.textContainer, responsiveStyles.textContainer]}>
                  <Animated.View
                    style={[
                      styles.headingContainer,
                      responsiveStyles.headingContainer,
                      {
                        opacity: headingOpacity,
                        transform: [{ translateY: headingTranslateY }],
                      },
                    ]}
                  >
                    <Text style={[styles.heading, responsiveStyles.heading]}>Enter Verification Code</Text>
                  </Animated.View>
                  <Animated.View
                    style={[
                      styles.paragraphContainer,
                      responsiveStyles.paragraphContainer,
                      {
                        opacity: paragraphOpacity,
                        transform: [{ translateY: paragraphTranslateY }],
                      },
                    ]}
                  >
                    <Text style={[styles.paragraph, responsiveStyles.paragraph]}>
                      We've sent a 4-digit code via {channelLabel}
                      {smsFallbackHint} to
                    </Text>
                  </Animated.View>
                </View>

                {/* Phone Number, Timer & Resend */}
                <View style={[styles.phoneTimerContainer, responsiveStyles.phoneTimerContainer]}>
                  <View style={[styles.phoneContainer, responsiveStyles.phoneContainer]}>
                    <Text style={[styles.phoneNumber, responsiveStyles.phoneNumber]}>{sessionMeta.displayTarget}</Text>
                  </View>
                  {timer > 0 ? (
                    <View style={[styles.timerContainer, responsiveStyles.timerContainer]}>
                      <Text style={[styles.timerText, responsiveStyles.timerText]}>Resend code in {formatTimer(timer)}</Text>
                    </View>
                  ) : (
                    <View style={styles.resendRow}>
                      <TouchableOpacity
                        style={[styles.timerContainer, responsiveStyles.timerContainer]}
                        onPress={handleResendOTP}
                        disabled={loading}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.resendLinkText, responsiveStyles.timerText]}>Resend OTP</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleChangeContact} activeOpacity={0.7}>
                        <Text style={[styles.changeContactText, responsiveStyles.timerText]}>
                          Change {sessionMeta.otpTarget === 'email' ? 'email' : 'number'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* OTP Inputs - Animated with Focus */}
                <View style={[styles.otpContainer, responsiveStyles.otpContainer]}>
                  {otp.map((digit, index) => {
                    return (
                      <Animated.View
                        key={index}
                        style={[
                          {
                            opacity: otpInputOpacities[index],
                            transform: [
                              { translateY: otpInputTranslateYs[index] },
                            ],
                          },
                        ]}
                      >
                        {/* Outer container for JS-driven border color animation */}
                        <Animated.View
                          style={[
                            styles.otpInput,
                            responsiveStyles.otpInput,
                            error && styles.otpInputError,
                            // Error state takes priority - use static border color
                            !error && {
                              // Animated border color only when no error (JS-driven)
                              borderColor: inputBorderColors[index].interpolate({
                                inputRange: [0, 1],
                                outputRange: ['#D1D1D1', '#034703'], // From default to focus color
                              }),
                            },
                          ]}
                        >
                          {/* Inner container for native-driven scale animation */}
                          <Animated.View
                            style={[
                              {
                                width: '100%',
                                height: '100%',
                                justifyContent: 'center',
                                alignItems: 'center',
                                transform: [{ scale: inputScales[index] }], // Native-driven
                              },
                            ]}
                          >
                            <TextInput
                              ref={(ref: TextInput | null) => { inputRefs.current[index] = ref; }}
                              style={[styles.otpInputText, responsiveStyles.otpInputText]}
                              value={digit}
                              onChangeText={(value) => handleOtpChange(value, index)}
                              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                              onFocus={() => setFocusedInputIndex(index)}
                              onBlur={() => setFocusedInputIndex(null)}
                              keyboardType="number-pad"
                              maxLength={index === 0 ? 4 : 1}
                              textAlign="center"
                              selectTextOnFocus
                              autoFocus={index === 0}
                              returnKeyType="done"
                              blurOnSubmit={index === 3}
                              onSubmitEditing={handleSubmitEditing}
                              textContentType="oneTimeCode"
                              autoComplete={index === 0 ? 'sms-otp' : 'off'}
                            />
                          </Animated.View>
                        </Animated.View>
                      </Animated.View>
                    );
                  })}
                </View>
                
                {/* Error Message - Animated */}
                {error && (
                  <Animated.View
                    style={[
                      {
                        opacity: errorOpacity,
                        transform: [{ translateY: errorTranslateY }],
                      },
                    ]}
                  >
                    <Text style={[styles.errorText, responsiveStyles.errorText]}>{error}</Text>
                  </Animated.View>
                )}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Action Container - stays at bottom; keyboard overlays it naturally */}
        <View style={[styles.actionContainer, responsiveStyles.actionContainer, { paddingBottom: Math.max(insets.bottom, getSpacing(24)) }]}>
          <TouchableOpacity
            style={[
              styles.verifyButton,
              responsiveStyles.verifyButton,
              (!isOtpComplete || loading) && styles.verifyButtonDisabled,
            ]}
            onPress={handleVerifyAndContinue}
            disabled={!isOtpComplete || loading}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.verifyButtonText,
              responsiveStyles.verifyButtonText,
              (!isOtpComplete || loading) && styles.verifyButtonTextDisabled,
            ]}>
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  body: {
    flex: 1,
    width: '100%',
  },
  keyboardView: {
    flex: 1,
    width: '100%',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    // Padding moved to responsiveStyles
  },
  contentWrapper: {
    width: '100%',
    alignItems: 'center',
    // MaxWidth and gap moved to responsiveStyles
  },
  iconContainer: {
    width: '100%',
    alignItems: 'center',
    // Gap moved to responsiveStyles
  },
  textContainer: {
    width: '100%',
    alignItems: 'center',
    // Gap moved to responsiveStyles
  },
  headingContainer: {
    width: '100%',
    alignItems: 'center',
    // Padding moved to responsiveStyles
  },
  heading: {
    fontFamily: 'Inter',
    fontWeight: '600',
    textAlign: 'center',
    color: '#1A1A1A',
    // Font size moved to responsiveStyles
  },
  paragraphContainer: {
    width: '100%',
    alignItems: 'center',
    // Padding moved to responsiveStyles
  },
  paragraph: {
    fontFamily: 'Inter',
    fontWeight: '400',
    textAlign: 'center',
    color: '#6B6B6B',
    // Font size moved to responsiveStyles
  },
  phoneTimerContainer: {
    width: '100%',
    alignItems: 'center',
    // Ensure container doesn't leak outside screen bounds
    position: 'relative',
    zIndex: 1,
    // Gap moved to responsiveStyles
  },
  phoneContainer: {
    justifyContent: 'center',
    // Height moved to responsiveStyles
  },
  phoneNumber: {
    fontFamily: 'Inter',
    fontWeight: '400',
    textAlign: 'center',
    color: '#1A1A1A',
    // Font size moved to responsiveStyles
  },
  timerContainer: {
    justifyContent: 'center',
    // Height moved to responsiveStyles
  },
  timerText: {
    fontFamily: 'Inter',
    fontWeight: '400',
    textAlign: 'center',
    color: '#6B6B6B',
  },
  resendLinkText: {
    fontFamily: 'Inter',
    fontWeight: '600',
    textAlign: 'center',
    color: '#034703',
  },
  resendRow: {
    alignItems: 'center',
    gap: 8,
  },
  changeContactText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    textAlign: 'center',
    color: '#034703',
    textDecorationLine: 'underline',
  },
  otpContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // Gap moved to responsiveStyles
  },
  otpInput: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#D1D1D1',
    overflow: 'hidden', // Ensure inner content doesn't overflow during scale
    // Dimensions and borderRadius moved to responsiveStyles
  },
  otpInputError: {
    borderColor: '#FF3B30',
  },
  otpInputText: {
    width: '100%',
    height: '100%',
    fontFamily: 'Inter',
    fontWeight: '400',
    color: '#1A1A1A',
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
    margin: 0,
    includeFontPadding: false,
    // Font size moved to responsiveStyles
    ...(Platform.OS === 'android' && {
      paddingVertical: 0,
      lineHeight: scaleFont(20, 18, 22),
    }),
    ...(Platform.OS === 'ios' && {
      paddingTop: 0,
      paddingBottom: 0,
      lineHeight: scaleFont(20, 18, 22),
    }),
  },
  errorText: {
    fontFamily: 'Inter',
    fontWeight: '400',
    color: '#FF3B30',
    textAlign: 'center',
    // Font size and margin moved to responsiveStyles
  },
  actionContainer: {
    width: '100%',
    // Padding and gap moved to responsiveStyles
  },
  verifyButton: {
    width: '100%',
    backgroundColor: '#034703',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    // Padding and borderRadius moved to responsiveStyles
  },
  verifyButtonDisabled: {
    backgroundColor: '#E8E8E8',
    opacity: 0.5,
  },
  verifyButtonText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
    // Font size moved to responsiveStyles
  },
  verifyButtonTextDisabled: {
    color: '#6B6B6B',
  },
});

export default OTPVerification;

