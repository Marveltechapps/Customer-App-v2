/**
 * Login Screen — Mobile / Email / WhatsApp tabs (Picker-style UI, Customer green theme)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Pressable,
  Platform,
  useWindowDimensions,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoginWelcomeSection from '@/components/auth/LoginWelcomeSection';
import LoginMethodTabs from '@/components/auth/LoginMethodTabs';
import PhoneInputRow from '@/components/auth/PhoneInputRow';
import ConsentCheckbox from '@/components/auth/ConsentCheckbox';
import CountryPickerModal from '@/components/auth/CountryPickerModal';
import PolicyModal from '@/components/auth/PolicyModal';
import Button from '@/components/common/Button';
import { useAuthScreenTheme } from '@/hooks/useAuthScreenTheme';
import {
  COUNTRY_LIST,
  DEFAULT_COUNTRY_CODE,
  findCountryByCode,
  findCountryByDialCode,
  type CountryOption,
} from '@/lib/countries';
import {
  formatNationalAsYouType,
  stripDigits,
  truncatePhoneForCountry,
  validatePhone,
} from '@/lib/phoneValidation';
import {
  sendLoginOtp,
  validateEmailFormat,
  isCompleteEmail,
  type LoginMode,
} from '@/services/auth/authService';
import { tokenManager } from '@/services/api/tokenManager';
import { savePendingOtpSession } from '@/utils/pendingOtpSession';
import { isLoginAuthorizedFromSplash, navigateToLoginScreen } from '@/utils/navigationRef';
import type { RootStackRouteProp } from '@/types/navigation';
import { Colors } from '@/constants/Colors';
import { APP_LAUNCH_ID } from '@/constants/appLaunch';

function parseLoginMode(value: unknown): LoginMode | null {
  if (value === 'email' || value === 'whatsapp' || value === 'mobile') return value;
  return null;
}

interface LoginScreenProps {
  onLoginSuccess?: (phoneNumber: string) => void;
}

const Login: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RootStackRouteProp<'Login'>>();
  const theme = useAuthScreenTheme();
  const { width: screenWidth } = useWindowDimensions();

  const routeParams = route.params ?? {};
  const initialMode = parseLoginMode((routeParams as { loginMode?: LoginMode }).loginMode) ?? 'mobile';
  const initialEmail = String((routeParams as { email?: string }).email ?? '');
  const initialPhone = stripDigits(String((routeParams as { phone?: string }).phone ?? ''));
  const initialCountry =
    findCountryByDialCode(String((routeParams as { countryCode?: string }).countryCode ?? '')) ??
    findCountryByCode(DEFAULT_COUNTRY_CODE) ??
    COUNTRY_LIST[0];

  const [readyToShow, setReadyToShow] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>(initialMode);
  const [country, setCountry] = useState<CountryOption>(initialCountry);
  const [phoneDigits, setPhoneDigits] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [consentChecked, setConsentChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [policyModal, setPolicyModal] = useState<'terms' | 'privacy' | null>(null);
  const emailInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);

  const dismissKeyboard = useCallback(() => {
    emailInputRef.current?.blur();
    phoneInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

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
        /* ignore */
      }
      if (!mounted) return;
      if (!isLoginAuthorizedFromSplash(route.params?.fromSplash)) {
        navigateToLoginScreen(navigation);
        return;
      }
      setReadyToShow(true);
    };
    check();
    return () => {
      mounted = false;
    };
  }, [navigation, route.params?.fromSplash]);

  useEffect(() => {
    dismissKeyboard();
  }, [dismissKeyboard]);

  useEffect(() => {
    const params = route.params as {
      loginMode?: LoginMode;
      email?: string;
      phone?: string;
      countryCode?: string;
    };
    const mode = parseLoginMode(params?.loginMode);
    if (mode) setLoginMode(mode);
    if (params?.email) setEmail(params.email);
    const paramPhone = stripDigits(params?.phone ?? '');
    if (paramPhone) setPhoneDigits(paramPhone);
    if (params?.countryCode) {
      const nextCountry = findCountryByDialCode(params.countryCode);
      if (nextCountry) setCountry(nextCountry);
    }
    if (mode || params?.email || params?.phone || params?.countryCode) {
      setFieldError(null);
    }
  }, [route.params]);

  const contentWidth = useMemo(
    () => Math.min(Math.max(screenWidth - 32, 320), 420),
    [screenWidth]
  );

  const formattedPhone = useMemo(
    () => formatNationalAsYouType(phoneDigits, country.code),
    [phoneDigits, country.code]
  );

  const phoneValidation = useMemo(() => {
    if (loginMode === 'email') return null;
    return validatePhone(
      phoneDigits,
      country.code,
      loginMode === 'whatsapp' ? 'whatsapp' : 'mobile'
    );
  }, [loginMode, phoneDigits, country.code]);

  const emailValid = useMemo(() => isCompleteEmail(email), [email]);

  const canSendOtp = useMemo(() => {
    if (loading || !consentChecked) return false;
    if (loginMode === 'email') return emailValid;
    return !!phoneDigits && (phoneValidation?.valid ?? false);
  }, [loading, consentChecked, loginMode, emailValid, phoneDigits, phoneValidation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.pageBg,
          position: 'relative',
        },
        cardShadow: {
          width: contentWidth,
          alignSelf: 'center',
          borderRadius: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.14,
          shadowRadius: 16,
          elevation: 10,
        },
        centeredBlock: {
          width: contentWidth,
          alignSelf: 'center',
        },
        formCard: {
          backgroundColor: theme.colors.surface,
          borderRadius: 20,
          overflow: 'hidden',
        },
        formBody: {
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 24,
        },
        scroll: { flex: 1 },
        scrollContent: {
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: theme.layout.contentPaddingH,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.xxl + 24,
        },
        methodLabel: {
          fontSize: theme.typography.fontSize.md,
          color: theme.colors.mutedText,
          marginBottom: theme.spacing.sm,
        },
        fieldSection: {
          marginTop: 20,
          marginBottom: 20,
        },
        fieldLabel: {
          fontSize: theme.typography.fontSize.md,
          color: theme.colors.textPrimary,
          marginBottom: theme.spacing.sm,
          fontWeight: theme.typography.fontWeight.bold,
        },
        emailInput: {
          borderWidth: 1,
          borderColor: '#B8D4BA',
          borderRadius: 12,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.md + 2,
          fontSize: theme.typography.fontSize.lg,
          color: theme.colors.textPrimary,
          backgroundColor: theme.colors.inputBg,
        },
        inputFocus: {
          borderColor: theme.colors.inputFocus,
          borderWidth: 1.5,
        },
        inputError: {
          borderColor: theme.colors.inputBorderError,
          borderWidth: 1.5,
        },
        errorText: {
          marginTop: theme.spacing.sm,
          fontSize: theme.typography.fontSize.sm,
          color: theme.colors.inputBorderError,
        },
        consentSection: {
          marginBottom: 20,
        },
        buttonContainer: {
          marginBottom: 4,
        },
      }),
    [theme, contentWidth]
  );

  const handleLoginModeChange = (mode: LoginMode) => {
    dismissKeyboard();
    setLoginMode(mode);
    setFieldError(null);
  };

  const handlePhoneChange = (text: string) => {
    const digits = truncatePhoneForCountry(stripDigits(text), country.code);
    setPhoneDigits(digits);
    if (fieldError) setFieldError(null);
    const validation = validatePhone(
      digits,
      country.code,
      loginMode === 'whatsapp' ? 'whatsapp' : 'mobile'
    );
    if (validation.valid) {
      phoneInputRef.current?.blur();
      Keyboard.dismiss();
    }
  };

  const handleCountrySelect = (next: CountryOption) => {
    dismissKeyboard();
    setCountry(next);
    setPhoneDigits((prev) => truncatePhoneForCountry(prev, next.code));
    setFieldError(null);
  };

  const handleEmailChange = (text: string) => {
    const cleaned = text.replace(/\s/g, '');
    setEmail(cleaned);
    if (fieldError) setFieldError(null);
  };

  const handleSendOTP = async () => {
    if (!consentChecked) return;

    if (loginMode === 'email') {
      const trimmed = email.trim();
      if (!trimmed) {
        setFieldError('Enter email address');
        return;
      }
      if (!validateEmailFormat(trimmed)) {
        setFieldError('Please enter a valid email address');
        return;
      }
      if (!isCompleteEmail(trimmed)) {
        setFieldError('Please enter a complete email address');
        return;
      }
    } else {
      if (!phoneDigits) {
        setFieldError(
          loginMode === 'whatsapp' ? 'Enter WhatsApp number' : 'Enter mobile number'
        );
        return;
      }
      if (!phoneValidation?.valid) {
        setFieldError(phoneValidation?.message ?? 'Invalid number format');
        return;
      }
    }

    dismissKeyboard();
    setLoading(true);
    setFieldError(null);

    try {
      const resp = await sendLoginOtp({
        loginMode,
        countryCode: country.dialCode,
        phone: phoneDigits,
        email: email.trim().toLowerCase(),
      });

      const sessionId = resp?.sessionId;
      if (!sessionId) {
        setFieldError('Failed to send OTP. Please try again.');
        return;
      }

      const otpTarget = loginMode === 'email' ? 'email' : 'phone';
      const normalizedEmail = email.trim().toLowerCase();
      const displayTarget =
        loginMode === 'email' ? normalizedEmail : `${country.dialCode} ${phoneDigits}`;
      const channel =
        resp.channel ?? (loginMode === 'whatsapp' ? 'whatsapp' : loginMode === 'email' ? 'email' : 'sms');

      const otpSession = {
        loginMode,
        otpTarget,
        countryCode: country.dialCode,
        phone: phoneDigits,
        email: normalizedEmail,
        channel,
        displayTarget,
        sessionId,
      };

      try {
        await savePendingOtpSession(otpSession);
      } catch {
        /* route params carry session */
      }

      navigation.navigate('OTPVerification', {
        sessionId,
        displayTarget,
        loginMode,
        otpTarget,
        countryCode: country.dialCode,
        phone: phoneDigits,
        email: normalizedEmail,
        channel,
        phoneNumber: displayTarget,
        fromSplash: route.params?.fromSplash ?? APP_LAUNCH_ID,
      });

      if (onLoginSuccess && loginMode !== 'email') {
        onLoginSuccess(`${country.dialCode}${phoneDigits}`.replace(/\s+/g, ''));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send OTP. Please try again.';
      setFieldError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!readyToShow) return null;

  const phoneLabel = loginMode === 'whatsapp' ? 'WhatsApp Number' : 'Mobile Number';
  const showPhoneInvalid = !!(phoneValidation?.showInvalid && fieldError === null && !phoneValidation.valid);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Pressable style={styles.container} onPress={dismissKeyboard} accessible={false}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.centeredBlock}>
              <LoginWelcomeSection />

              <View style={styles.cardShadow}>
                <View style={styles.formCard}>
                  <View style={styles.formBody}>
                    <Text style={styles.methodLabel}>Choose login method</Text>
                    <LoginMethodTabs value={loginMode} onChange={handleLoginModeChange} />

                    <View style={styles.fieldSection}>
                {loginMode === 'email' ? (
                  <View>
                    <Text style={styles.fieldLabel}>Email Address</Text>
                    <TextInput
                      ref={emailInputRef}
                      style={[
                        styles.emailInput,
                        (emailFocused || email.length > 0) && !fieldError && styles.inputFocus,
                        fieldError && loginMode === 'email' && styles.inputError,
                      ]}
                      placeholder="you@example.com"
                      placeholderTextColor={theme.colors.placeholder}
                      value={email}
                      onChangeText={handleEmailChange}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      blurOnSubmit={false}
                      autoComplete="off"
                      textContentType="none"
                      importantForAutofill="no"
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      onSubmitEditing={() => {
                        if (isCompleteEmail(email)) dismissKeyboard();
                      }}
                    />
                  </View>
                ) : (
                  <PhoneInputRow
                    country={country}
                    value={formattedPhone}
                    onChangeText={handlePhoneChange}
                    onCountryPress={() => {
                      dismissKeyboard();
                      setCountryPickerVisible(true);
                    }}
                    hasError={!!fieldError || showPhoneInvalid}
                    isFocused={phoneFocused}
                    hasInput={phoneDigits.length > 0}
                    label={phoneLabel}
                    inputRef={phoneInputRef}
                    onFocus={() => setPhoneFocused(true)}
                    onBlur={() => setPhoneFocused(false)}
                    onSubmitEditing={dismissKeyboard}
                  />
                )}

                {fieldError ? <Text style={styles.errorText}>{fieldError}</Text> : null}
                {showPhoneInvalid && phoneValidation?.message ? (
                  <Text style={styles.errorText}>{phoneValidation.message}</Text>
                ) : null}
              </View>

              <View style={styles.consentSection}>
                <ConsentCheckbox
                  checked={consentChecked}
                  onToggle={() => {
                    dismissKeyboard();
                    setConsentChecked((v) => !v);
                  }}
                  onTermsPress={() => {
                    dismissKeyboard();
                    setPolicyModal('terms');
                  }}
                  onPrivacyPress={() => {
                    dismissKeyboard();
                    setPolicyModal('privacy');
                  }}
                />
              </View>

              <View style={styles.buttonContainer}>
                <Button
                  title="Send OTP"
                  onPress={handleSendOTP}
                  disabled={!canSendOtp}
                  loading={loading}
                  variant="primary"
                  style={{ borderRadius: 12, minHeight: 52 }}
                />
              </View>
                </View>
              </View>
            </View>
            </View>
          </ScrollView>

          <CountryPickerModal
            visible={countryPickerVisible}
            selectedCode={country.code}
            onSelect={handleCountrySelect}
            onClose={() => setCountryPickerVisible(false)}
          />

        <PolicyModal
          visible={policyModal !== null}
          type={policyModal ?? 'terms'}
          onClose={() => setPolicyModal(null)}
        />
        </KeyboardAvoidingView>
      </Pressable>
    </SafeAreaView>
  );
};

export default Login;
