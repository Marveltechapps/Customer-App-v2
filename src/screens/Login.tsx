import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackRouteProp } from '../types/navigation';

const selorgLogo = require('../../assets/selorg-logo.png');
import { sendOtp } from '../services/auth/authService';
import { tokenManager } from '../services/api/tokenManager';
import { getLegalConfig } from '../services/legal/legalService';
import type { LoginLegalConfig } from '../services/legal/legalService';
import CountryFlagIcon from '../assets/images/country-flag-icon.svg';
import { useDimensions, scale, scaleFont, getSpacing, getBorderRadius, wp } from '../utils/responsive';
import { logger } from '@/utils/logger';
import { isLoginAuthorizedFromSplash, navigateToLoginScreen } from '../utils/navigationRef';
import { getApiErrorMessage } from '../services/api/types';
import { useAppConfig } from '../contexts/AppConfigContext';

const DEFAULT_PHONE_NUMBER = '';

interface LoginScreenProps {
  onLoginSuccess?: (phoneNumber: string) => void;
}

/**
 * Login Screen Component
 * Recreated from Figma design
 * Displays login form with mobile number input
 */
const Login: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RootStackRouteProp<'Login'>>();
  const { width } = useDimensions();
  const [readyToShow, setReadyToShow] = useState(false);
  const insets = useSafeAreaInsets();
  const { appConfig } = useAppConfig();
  const defaultCountryCode = appConfig.branding?.countryCode ?? '+91';
  const [phoneNumber, setPhoneNumber] = useState<string>(DEFAULT_PHONE_NUMBER);
  const [countryCode, setCountryCode] = useState<string>(defaultCountryCode);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [loginLegal, setLoginLegal] = useState<LoginLegalConfig | null>(null);

  // Auth guard: valid session → home; otherwise require Splash → Login for this app launch
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        await tokenManager.initialize();
        if (!mounted) return;
        if (tokenManager.isTokenValid()) {
          navigation.replace('MainTabs');
          return;
        }
      } catch {
        // ignore init errors; still enforce splash-first below
      }
      if (!mounted) return;
      if (!isLoginAuthorizedFromSplash(route.params?.fromSplash)) {
        navigateToLoginScreen(navigation);
        return;
      }
      setReadyToShow(true);
    };
    check();
    return () => { mounted = false; };
  }, [navigation, route.params?.fromSplash]);

  useRefreshOnFocus(() => {
    void getLegalConfig()
      .then((res) => {
        if (res.success && res.data?.loginLegal) setLoginLegal(res.data.loginLegal);
      })
      .catch((err) => logger.warn('Legal config failed', { message: getApiErrorMessage(err, 'Failed to load legal config') }));
  }, []);

  // Responsive styles memoized
  const responsiveStyles = useMemo(() => ({
    headerSection: {
      paddingVertical: getSpacing(24),
      paddingHorizontal: getSpacing(16),
    },
    headerContent: {
      gap: getSpacing(12),
      paddingVertical: getSpacing(4),
    },
    logoContainer: {
      width: scale(56),
      height: scale(56),
      borderRadius: scale(28),
    },
    titleContainer: {
      paddingHorizontal: wp(14.13), // Responsive instead of 53px
    },
    title: {
      fontSize: scaleFont(32, 28, 36),
      lineHeight: scaleFont(38.4, 34, 42),
    },
    subtitleContainer: {
      paddingHorizontal: wp(15.73), // Responsive instead of 59px
    },
    subtitle: {
      fontSize: scaleFont(14, 12, 16),
      lineHeight: scaleFont(21, 18, 24),
    },
    contentSection: {
      paddingTop: getSpacing(20),
      paddingBottom: getSpacing(20),
      paddingHorizontal: getSpacing(16),
      gap: getSpacing(24),
    },
    sectionHeader: {
      gap: getSpacing(8),
      height: scale(55.3),
    },
    sectionTitle: {
      fontSize: scaleFont(22, 20, 24),
      lineHeight: scaleFont(30.8, 28, 34),
    },
    sectionSubtitle: {
      fontSize: scaleFont(12.25, 11, 14),
      lineHeight: scaleFont(17.5, 16, 20),
    },
    inputWrapper: {
      paddingVertical: 0, // Remove extra vertical padding for perfect centering
      paddingHorizontal: getSpacing(14),
      height: scale(54), // Fixed height so text is always centered
      minHeight: scale(54),
      borderRadius: scale(12),
    },
    countryCodeContainer: {
      width: scale(42.41),
    },
    countryCodeText: {
      fontSize: scaleFont(12.25, 11, 14),
      lineHeight: scaleFont(17.5, 16, 20),
    },
    phoneInput: {
      fontSize: scaleFont(14, 13, 15), // Reduced size for placeholder and entered number
      lineHeight: scaleFont(18, 17, 19), // Adjusted lineHeight for smaller font
    },
    noteText: {
      fontSize: scaleFont(12, 11, 14),
      lineHeight: scaleFont(16, 14, 18),
    },
    errorText: {
      fontSize: scaleFont(12, 11, 14),
      lineHeight: scaleFont(16, 14, 18),
      marginTop: getSpacing(4),
    },
    actionSection: {
      paddingTop: getSpacing(24),
      paddingHorizontal: getSpacing(16),
      gap: getSpacing(14),
      // paddingBottom will be set dynamically with safe area insets
    },
    sendOTPButton: {
      paddingVertical: getSpacing(13),
      paddingHorizontal: wp(36.27), // Responsive instead of 136px
      borderRadius: scale(8),
    },
    sendOTPButtonText: {
      fontSize: scaleFont(14, 12, 16),
      lineHeight: scaleFont(22.4, 20, 24),
    },
    termsContainer: {
      paddingHorizontal: wp(5.07), // Responsive instead of 19px
    },
    termsText: {
      fontSize: scaleFont(12, 11, 14),
      lineHeight: scaleFont(16, 14, 18),
      width: wp(80.27), // Responsive instead of 301px
    },
  }), [width]);

  // Animation values for header fade-in
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.95)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(10)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(10)).current;

  // Animation values for input focus
  const inputScale = useRef(new Animated.Value(1)).current;
  const inputBorderColor = useRef(new Animated.Value(0)).current;

  // Animation values for error message
  const errorOpacity = useRef(new Animated.Value(0)).current;
  const errorTranslateY = useRef(new Animated.Value(-20)).current;

  // Header fade-in animation on mount
  useEffect(() => {
    // Logo animation
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Title animation - starts after logo (100ms delay)
    Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 400,
        delay: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(titleTranslateY, {
        toValue: 0,
        duration: 400,
        delay: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Subtitle animation - starts after title (200ms delay)
    Animated.parallel([
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 400,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(subtitleTranslateY, {
        toValue: 0,
        duration: 400,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Input focus animation
  useEffect(() => {
    // Don't animate if there's an error (error state takes priority)
    if (error) {
      inputBorderColor.setValue(0); // Reset to default when error appears
      return;
    }

    Animated.parallel([
      Animated.timing(inputScale, {
        toValue: isInputFocused ? 1.01 : 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(inputBorderColor, {
        toValue: isInputFocused ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // Color animation requires false
      }),
    ]).start();
  }, [isInputFocused, error]);

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

  // Placeholder function for API integration
  const handleSendOTP = async () => {
    setLoading(true);
    setError(null);

    try {
      const fullPhone = `${countryCode}${phoneNumber}`.replace(/\s+/g, '');
      logger.info('Sending OTP', { phoneNumber: fullPhone });

      const resp = await sendOtp(fullPhone);
      // Debug: print full response to Metro/Xcode logs for troubleshooting
      try {
        // eslint-disable-next-line no-console
        console.debug('[Login] sendOtp response:', resp);
      } catch (e) {
        // ignore
      }

      // Defensive handling: backend may return sessionId at top-level or inside data.
      // ApiResponse shape: { success, data?, message?, ... } OR legacy { sessionId, ... }
      const topLevelSessionId = (resp as any)?.sessionId;
      const dataSessionId = (resp as any)?.data?.sessionId;
      const sessionId = topLevelSessionId || dataSessionId || null;

      // If API explicitly failed, show message
      if (resp && (resp as any).success === false) {
        const msg = (resp as any).message || (resp as any).error || 'Failed to send OTP';
        logger.warn('sendOtp responded with success=false', { phoneNumber: fullPhone, resp });
        setError(msg);
        return;
      }

      if (sessionId) {
        // Navigate to OTP verification screen and pass sessionId (if backend returns it)
        navigation.navigate('OTPVerification', {
          phoneNumber: `${countryCode} ${phoneNumber}`,
          sessionId,
        } as never);

        // Call onLoginSuccess if provided (for backward compatibility)
        if (onLoginSuccess) {
          onLoginSuccess(fullPhone);
        }
        return;
      }

      // If we reach here, no sessionId was returned — log and show fallback error
      logger.warn('sendOtp did not return sessionId', { phoneNumber: fullPhone, resp });
      setError((resp as any)?.message || 'Failed to send OTP');
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to send OTP. Please try again.');
      logger.error('Send OTP failed', { message: msg });
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleTermsPress = () => {
    const terms = loginLegal?.terms;
    if (terms?.type === 'url' && terms?.url) {
      Linking.openURL(terms.url).catch((err) => logger.warn('Failed to open terms URL', err));
    } else {
      navigation.navigate('GeneralInfo', { screen: 'TermsAndConditions' });
    }
    logger.info('Terms pressed');
  };

  const handlePrivacyPress = () => {
    const privacy = loginLegal?.privacy;
    if (privacy?.type === 'url' && privacy?.url) {
      Linking.openURL(privacy.url).catch((err) => logger.warn('Failed to open privacy URL', err));
    } else {
      navigation.navigate('GeneralInfo', { screen: 'PrivacyPolicy' });
    }
    logger.info('Privacy pressed');
  };

  const isValidPhoneNumber = (phone: string): boolean => {
    // Basic validation - replace with proper validation
    return phone.length >= 10 && /^\d+$/.test(phone);
  };

  if (!readyToShow) {
    return <View style={styles.splashPlaceholder} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#034703" />
      
      {/* Header Section - Green Background - Starts from safe area */}
      <SafeAreaView style={styles.headerSafeArea} edges={['top', 'bottom']}>
        <View style={[styles.headerSection, responsiveStyles.headerSection]}>
          <View style={[styles.headerContent, responsiveStyles.headerContent]}>
            {/* Logo Container with circular white background at 20% opacity - Animated */}
            <Animated.View
              style={[
                styles.logoContainer,
                responsiveStyles.logoContainer,
                {
                  opacity: logoOpacity,
                  transform: [{ scale: logoScale }],
                },
              ]}
            >
              <Image source={selorgLogo} style={styles.logoImage} resizeMode="contain" />
            </Animated.View>
            
            {/* Title - Animated */}
            <Animated.View
              style={[
                styles.titleContainer,
                responsiveStyles.titleContainer,
                {
                  opacity: titleOpacity,
                  transform: [{ translateY: titleTranslateY }],
                },
              ]}
            >
              <Text style={[styles.title, responsiveStyles.title]}>Selorg Organic</Text>
            </Animated.View>
            
            {/* Subtitle - Animated */}
            <Animated.View
              style={[
                styles.subtitleContainer,
                responsiveStyles.subtitleContainer,
                {
                  opacity: subtitleOpacity,
                  transform: [{ translateY: subtitleTranslateY }],
                },
              ]}
            >
              <Text style={[styles.subtitle, responsiveStyles.subtitle]}>Fresh organic groceries delivered</Text>
            </Animated.View>
          </View>
        </View>
      </SafeAreaView>

      {/* Content Section - White Background */}
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
            <View style={[styles.contentSection, responsiveStyles.contentSection]}>
              {/* Section Header */}
              <View style={[styles.sectionHeader, responsiveStyles.sectionHeader]}>
                <Text style={[styles.sectionTitle, responsiveStyles.sectionTitle]}>Login or Sign Up</Text>
                <Text style={[styles.sectionSubtitle, responsiveStyles.sectionSubtitle]}>
                  Enter your mobile number to continue
                </Text>
              </View>

              {/* Input Container */}
              <View style={styles.inputSection}>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Mobile Number</Text>
                  {/* Outer container for JS-driven border color animation */}
                  <Animated.View
                    style={[
                      styles.inputWrapper,
                      responsiveStyles.inputWrapper,
                      // Error state takes priority - use static border color
                      error ? styles.inputWrapperError : {
                        // Animated border color only when no error (JS-driven)
                        borderColor: inputBorderColor.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['#D1D1D1', '#034703'], // From default to focus color
                        }),
                        borderWidth: isInputFocused ? 2 : 1.5,
                      },
                    ]}
                  >
                    {/* Inner container for native-driven scale animation */}
                    <Animated.View
                      style={[
                        styles.inputInnerContainer,
                        {
                          transform: [{ scale: inputScale }], // Native-driven
                        },
                      ]}
                    >
                      {/* Country Code with Flag */}
                      <View style={[styles.countryCodeContainer, responsiveStyles.countryCodeContainer]}>
                        <CountryFlagIcon width={scale(14)} height={scale(14)} />
                        <Text style={[styles.countryCodeText, responsiveStyles.countryCodeText]}>{countryCode}</Text>
                      </View>
                      
                      {/* Phone Number Input */}
                      <View style={styles.phoneInputContainer}>
                        <TextInput
                          style={[styles.phoneInput, responsiveStyles.phoneInput]}
                          value={phoneNumber}
                          onChangeText={setPhoneNumber}
                          placeholder="Enter mobile number"
                          placeholderTextColor="#6B6B6B"
                          keyboardType="phone-pad"
                          maxLength={10}
                          autoComplete="tel"
                          textContentType="telephoneNumber"
                          textAlignVertical="center"
                          numberOfLines={1}
                          onFocus={() => setIsInputFocused(true)}
                          onBlur={() => setIsInputFocused(false)}
                          returnKeyType="done"
                          blurOnSubmit={true}
                        />
                      </View>
                    </Animated.View>
                  </Animated.View>
                </View>
                
                {/* Note Text */}
                <Text style={[styles.noteText, responsiveStyles.noteText]}>
                  We'll send you an OTP to verify your number
                </Text>
                
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

        {/* Action Section - stays at bottom; keyboard overlays it naturally */}
        <View style={[styles.actionSection, responsiveStyles.actionSection, { paddingBottom: Math.max(insets.bottom, getSpacing(24)) }]}>
          <TouchableOpacity
            style={[
              styles.sendOTPButton,
              responsiveStyles.sendOTPButton,
              (!isValidPhoneNumber(phoneNumber) || loading) && styles.sendOTPButtonDisabled,
            ]}
            onPress={handleSendOTP}
            disabled={!isValidPhoneNumber(phoneNumber) || loading}
            activeOpacity={0.8}
          >
            <Text style={[styles.sendOTPButtonText, responsiveStyles.sendOTPButtonText]}>
              {loading ? 'Sending...' : 'Send OTP'}
            </Text>
          </TouchableOpacity>

          <View style={[styles.termsContainer, responsiveStyles.termsContainer]}>
            <Text style={[styles.termsText, responsiveStyles.termsText]}>
              {loginLegal?.preamble ?? 'By continuing, you agree to our '}
              <Text style={styles.termsLink} onPress={handleTermsPress}>
                {loginLegal?.terms?.label ?? 'Terms of Service'}
              </Text>
              {loginLegal?.connector ?? ' and '}
              <Text style={styles.termsLink} onPress={handlePrivacyPress}>
                {loginLegal?.privacy?.label ?? 'Privacy Policy'}
              </Text>
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  splashPlaceholder: {
    flex: 1,
    backgroundColor: '#034703',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  headerSafeArea: {
    backgroundColor: '#034703',
  },
  headerSection: {
    width: '100%',
    backgroundColor: '#034703',
    // Padding moved to responsiveStyles
  },
  headerContent: {
    alignItems: 'center',
    width: '100%',
    // Gap and padding moved to responsiveStyles
  },
  logoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    // Dimensions moved to responsiveStyles
  },
  logoImage: {
    width: scale(31.5),
    height: scale(31.5),
  },
  titleContainer: {
    width: '100%',
    // Padding moved to responsiveStyles
  },
  title: {
    fontFamily: 'Inter',
    fontWeight: '700',
    textAlign: 'center',
    color: '#FFFFFF',
    // Font size moved to responsiveStyles
  },
  subtitleContainer: {
    width: '100%',
    // Padding moved to responsiveStyles
  },
  subtitle: {
    fontFamily: 'Inter',
    fontWeight: '400',
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.9)',
    // Font size moved to responsiveStyles
  },
  body: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  contentSection: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    // Padding and gap moved to responsiveStyles
  },
  sectionHeader: {
    width: '100%',
    // Gap and height moved to responsiveStyles
  },
  sectionTitle: {
    fontFamily: 'Inter',
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'left',
    // Font size moved to responsiveStyles
  },
  sectionSubtitle: {
    fontFamily: 'Inter',
    fontWeight: '400',
    color: '#6B6B6B',
    textAlign: 'left',
    // Font size moved to responsiveStyles
  },
  inputSection: {
    width: '100%',
    gap: getSpacing(12),
  },
  inputContainer: {
    width: '100%',
    gap: getSpacing(4),
  },
  inputLabel: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: scaleFont(12, 11, 14),
    lineHeight: scaleFont(18, 16, 20),
    color: '#1A1A1A',
    textAlign: 'left',
  },
  inputWrapper: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D1D1D1',
    overflow: 'hidden', // Ensure inner content doesn't overflow during scale
    height: scale(54), // Fixed height for perfect centering
    minHeight: scale(54),
    // Padding, height, and borderRadius moved to responsiveStyles
  },
  inputInnerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    gap: getSpacing(8),
    height: '100%',
    minHeight: scale(54),
    paddingVertical: 0, // Remove extra vertical padding
  },
  inputWrapperError: {
    borderColor: '#FF3B30',
    borderWidth: 1.5,
  },
  countryCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: getSpacing(4),
    justifyContent: 'center',
    // Width moved to responsiveStyles
  },
  countryCodeText: {
    fontFamily: 'Inter',
    fontWeight: '400',
    color: '#2A2A2A',
    textAlignVertical: 'center',
    // Font size moved to responsiveStyles
  },
  phoneInputContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    height: '100%',
    paddingVertical: 0, // Ensures vertical center
  },
  phoneInput: {
    width: '100%',
    fontFamily: 'Inter',
    fontWeight: '400',
    color: '#1A1A1A',
    paddingHorizontal: 0,
    paddingVertical: 0,
    margin: 0,
    textAlignVertical: 'center',
    textAlign: 'left',
    includeFontPadding: false,
    fontSize: scaleFont(14, 13, 15), // Reduced size for entered number
    lineHeight: scaleFont(18, 17, 19), // Adjusted lineHeight for smaller font
    // Font size moved to responsiveStyles
    ...(Platform.OS === 'android' && {
      paddingVertical: 0,
    }),
    ...(Platform.OS === 'ios' && {
      paddingTop: 0,
      paddingBottom: 0,
    }),
  },
  noteText: {
    fontFamily: 'Inter',
    fontWeight: '400',
    color: '#6B6B6B',
    textAlign: 'left',
    // Font size moved to responsiveStyles
  },
  errorText: {
    fontFamily: 'Inter',
    fontWeight: '400',
    color: '#FF3B30',
    // Font size and margin moved to responsiveStyles
  },
  actionSection: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    // Padding and gap moved to responsiveStyles
  },
  sendOTPButton: {
    width: '100%',
    backgroundColor: '#034703',
    justifyContent: 'center',
    alignItems: 'center',
    gap: getSpacing(10),
    // Padding and borderRadius moved to responsiveStyles
  },
  sendOTPButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  sendOTPButtonText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
    // Font size moved to responsiveStyles
  },
  termsContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    // Padding moved to responsiveStyles
  },
  termsText: {
    fontFamily: 'Inter',
    fontWeight: '400',
    color: '#6B6B6B',
    textAlign: 'center',
    // Font size and width moved to responsiveStyles
  },
  termsLink: {
    color: '#034703',
    textDecorationLine: 'underline',
  },
});

export default Login;
