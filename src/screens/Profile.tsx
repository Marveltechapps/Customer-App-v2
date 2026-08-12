import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import Header from '../components/layout/Header';
import ProfileUpdateSuccess from './ProfileUpdateSuccess';
import { logger } from '@/utils/logger';
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  sendLinkPhoneOtp,
  verifyLinkPhoneOtp,
  resendLinkPhoneOtp,
} from '../services/profile/profileService';
import { getApiErrorMessage } from '../services/api/types';
import { useUser } from '../contexts/UserContext';
import { saveUserData } from '../utils/storage';
import { useResponsive } from '@/utils/responsive';
import { validatePhone, stripDigits } from '@/lib/phoneValidation';

function normalizeAuthPhone(value: unknown): string {
  if (typeof value !== 'string') return '';
  const digits = stripDigits(value).slice(-10);
  return digits.length === 10 ? digits : '';
}

async function uriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? '');
      const base64 = result.includes(',') ? result.split(',')[1]! : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(blob);
  });
}

const Profile: React.FC = () => {
  const { isTablet, scaleFont: rFont } = useResponsive();
  const { user, setUser } = useUser();
  const userRef = useRef(user);
  const [name, setName] = useState<string>('');
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [emailAddress, setEmailAddress] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [phoneStep, setPhoneStep] = useState<'idle' | 'otp'>('idle');
  const [phoneSessionId, setPhoneSessionId] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const otpInputRefs = useRef<(TextInput | null)[]>([]);
  const lastFetchAtRef = useRef(0);

  const phoneLocked = phoneVerified && normalizeAuthPhone(mobileNumber).length === 10;
  const hasLinkedPhone = normalizeAuthPhone(mobileNumber).length === 10;

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const normalizeEmail = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    // Backend temporary placeholder for OTP-only users should not replace real email.
    if (/^no-email-.*@no-email\.selorg$/i.test(trimmed)) return '';
    return trimmed;
  };

  const firstNonEmpty = (...values: Array<unknown>): string => {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  };

  const applyProfileData = (raw: Record<string, any> | undefined, fallback?: Record<string, any> | null) => {
    if (!raw) {
      return;
    }
    const savedCheckoutContact = (raw.savedCheckoutContact ?? {}) as Record<string, any>;
    const fallbackSavedCheckoutContact = ((fallback?.savedCheckoutContact ?? {}) as Record<string, any>);
    setName(
      firstNonEmpty(
        raw.name,
        raw.fullName,
        savedCheckoutContact.fullName,
        fallback?.name,
        fallback?.fullName,
        fallbackSavedCheckoutContact.fullName
      )
    );
    // Auth phone only — do not fall back to checkout contact (that is not a linked/verified number).
    const authPhone = normalizeAuthPhone(
      firstNonEmpty(
        raw.phoneNumber,
        raw.mobileNumber,
        fallback?.phoneNumber,
        fallback?.mobileNumber
      )
    );
    setMobileNumber(authPhone);
    const verified =
      Boolean(raw.phoneVerified ?? fallback?.phoneVerified) && authPhone.length === 10;
    setPhoneVerified(verified);
    const resolvedEmail = firstNonEmpty(
      normalizeEmail(raw.email),
      normalizeEmail(raw.emailAddress),
      normalizeEmail(savedCheckoutContact.email),
      normalizeEmail(fallback?.email),
      normalizeEmail(fallback?.emailAddress),
      normalizeEmail(fallbackSavedCheckoutContact.email)
    );
    setEmailAddress(resolvedEmail);
    const nextAvatar = firstNonEmpty(
      raw.avatarUrl,
      raw.avatar,
      fallback?.avatarUrl,
      fallback?.avatar
    );
    if (nextAvatar) setAvatarUrl(nextAvatar);
  };

  useEffect(() => {
    if (user) {
      applyProfileData(user as Record<string, any>, null);
    }
  }, [user]);

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  const fetchProfileData = useCallback(async (options?: { force?: boolean }) => {
    const now = Date.now();
    if (!options?.force && lastFetchAtRef.current && now - lastFetchAtRef.current < 45_000) {
      logger.info('[profile-perf] skip focus fetch (fresh cache)', {
        elapsedMs: now - lastFetchAtRef.current,
      });
      return;
    }
    const t0 = Date.now();
    logger.info('[profile-perf] screen open / fetch start');
    setIsFetchingProfile(true);
    try {
      logger.info('[profile-perf] API start');
      const res = await getProfile();
      logger.info('[profile-perf] API finish', { elapsedMs: Date.now() - t0 });
      const responseData = (res as any)?.data;
      const data = (responseData?.user ?? responseData) as Record<string, any> | undefined;
      if (res?.success && data) {
        logger.info('[profile] fetch success', {
          name: data.name ?? data.fullName,
          email: data.email ?? data.emailAddress,
          phoneNumber: data.phoneNumber ?? data.mobileNumber ?? data.phone,
        });
        applyProfileData(data, (userRef.current ?? null) as Record<string, any> | null);
        const mergedUser = { ...(userRef.current ?? {}), ...data };
        setUser(mergedUser);
        logger.info('[profile] context updated from fetch', {
          name: mergedUser.name ?? mergedUser.fullName,
          email: mergedUser.email ?? mergedUser.emailAddress,
          phoneNumber: mergedUser.phoneNumber ?? mergedUser.mobileNumber ?? mergedUser.phone,
        });
        const payload = JSON.stringify(mergedUser);
        if (payload !== JSON.stringify(userRef.current ?? {})) {
          await saveUserData(payload);
          logger.info('[profile] storage updated from fetch');
        }
        lastFetchAtRef.current = Date.now();
      } else if (user) {
        applyProfileData(user as Record<string, any>, null);
      }
    } catch (error) {
      logger.error('Error fetching profile data', error);
      if (user) {
        applyProfileData(user as Record<string, any>, null);
      }
    } finally {
      setIsFetchingProfile(false);
      logger.info('[profile-perf] UI render complete', { elapsedMs: Date.now() - t0 });
    }
  }, []);

  useRefreshOnFocus(() => {
    if (isUpdatingProfile) {
      return;
    }
    void fetchProfileData();
  }, [fetchProfileData, isUpdatingProfile]);

  const handleUpdate = async () => {
    setIsUpdatingProfile(true);
    try {
      const trimmedName = name.trim();
      const trimmedEmail = emailAddress.trim();
      const linkedPhone = phoneLocked ? normalizeAuthPhone(mobileNumber) : normalizeAuthPhone(
        (userRef.current as Record<string, any> | null)?.phoneNumber ||
          (userRef.current as Record<string, any> | null)?.mobileNumber ||
          ''
      );
      logger.info('[profile] update submit', {
        payload: { name: trimmedName, email: trimmedEmail, phoneLocked },
      });
      const optimisticUser = {
        ...(userRef.current ?? {}),
        name: trimmedName || (userRef.current as Record<string, any> | null)?.name,
        email: trimmedEmail || (userRef.current as Record<string, any> | null)?.email,
        phoneNumber: linkedPhone || undefined,
        mobileNumber: linkedPhone || undefined,
        phoneVerified: phoneLocked || Boolean((userRef.current as any)?.phoneVerified),
        savedCheckoutContact: {
          ...(((userRef.current as Record<string, any> | null)?.savedCheckoutContact ?? {}) as Record<string, any>),
          fullName: trimmedName || undefined,
          email: trimmedEmail || undefined,
          // Keep checkout contact phone in sync with linked auth phone only when locked.
          ...(linkedPhone ? { phone: linkedPhone } : {}),
        },
      };

      // Optimistic update so all screens reflect edits immediately.
      applyProfileData(optimisticUser);
      setUser(optimisticUser);
      logger.info('[profile] context updated optimistic', {
        name: optimisticUser.name,
        email: optimisticUser.email,
        phoneNumber: optimisticUser.phoneNumber,
      });
      await saveUserData(JSON.stringify(optimisticUser));
      logger.info('[profile] storage updated optimistic');

      const payload = {
        name: trimmedName,
        email: trimmedEmail,
        // Persist editable contact details for checkout/profile fallbacks.
        // Do not send auth phoneNumber — linking requires OTP endpoints.
        savedCheckoutContact: {
          fullName: trimmedName || undefined,
          email: trimmedEmail || undefined,
          ...(linkedPhone ? { phone: linkedPhone } : {}),
        },
      };
      const res = await updateProfile(payload);
      if (res?.success && res.data) {
        const responseData = res.data as Record<string, any>;
        logger.info('[profile] update api success', {
          name: responseData.name ?? responseData.fullName,
          email: responseData.email ?? responseData.emailAddress,
          phoneNumber: responseData.phoneNumber ?? responseData.mobileNumber ?? responseData.phone,
        });
        applyProfileData(responseData, optimisticUser);
        const mergedUser = {
          ...(optimisticUser ?? {}),
          ...responseData,
          name: trimmedName || responseData.name || responseData.fullName,
          email: trimmedEmail || responseData.email || responseData.emailAddress,
          phoneNumber:
            normalizeAuthPhone(responseData.phoneNumber) ||
            linkedPhone ||
            undefined,
          mobileNumber:
            normalizeAuthPhone(responseData.mobileNumber || responseData.phoneNumber) ||
            linkedPhone ||
            undefined,
          phoneVerified: Boolean(responseData.phoneVerified ?? optimisticUser.phoneVerified),
        };
        setUser(mergedUser);
        logger.info('[profile] context updated final', {
          name: mergedUser.name,
          email: mergedUser.email,
          phoneNumber: mergedUser.phoneNumber ?? mergedUser.mobileNumber,
        });
        await saveUserData(JSON.stringify(mergedUser));
        logger.info('[profile] storage updated final');
      }
      setShowSuccessModal(true);
    } catch (error) {
      logger.error('Error updating profile', error);
      // Re-sync from server/session if API update fails after optimistic update.
      void fetchProfileData({ force: true });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    const digits = normalizeAuthPhone(mobileNumber);
    const validation = validatePhone(digits, 'IN', 'mobile');
    if (!validation.valid) {
      setPhoneError(validation.message || 'Enter a valid 10-digit mobile number');
      return;
    }
    setPhoneBusy(true);
    setPhoneError(null);
    try {
      const res = await sendLinkPhoneOtp(digits, 'sms');
      const sessionId = (res as any)?.sessionId ?? (res as any)?.data?.sessionId;
      if (!sessionId) {
        throw new Error(getApiErrorMessage(res, 'Failed to send OTP'));
      }
      setPhoneSessionId(sessionId);
      setOtpCooldown(
        (res as any)?.resendCooldownSeconds ?? (res as any)?.data?.resendCooldownSeconds ?? 30
      );
      setOtpDigits(['', '', '', '']);
      setPhoneStep('otp');
      setTimeout(() => otpInputRefs.current[0]?.focus(), 80);
    } catch (err) {
      setPhoneError(getApiErrorMessage(err, 'Could not send OTP. Please try again.'));
    } finally {
      setPhoneBusy(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    const code = otpDigits.join('');
    if (code.length !== 4 || !phoneSessionId) {
      setPhoneError('Enter the 4-digit OTP');
      return;
    }
    setPhoneBusy(true);
    setPhoneError(null);
    try {
      const res = await verifyLinkPhoneOtp(phoneSessionId, code);
      const responseData = ((res as any)?.data ?? res) as Record<string, any>;
      if (!res?.success && !responseData?.phoneNumber) {
        throw new Error(getApiErrorMessage(res, 'Could not verify phone number'));
      }
      const linked = normalizeAuthPhone(responseData.phoneNumber || mobileNumber);
      const mergedUser = {
        ...(userRef.current ?? {}),
        ...responseData,
        phoneNumber: linked,
        mobileNumber: linked,
        phoneVerified: true,
      };
      applyProfileData(mergedUser);
      setUser(mergedUser);
      await saveUserData(JSON.stringify(mergedUser));
      setPhoneStep('idle');
      setOtpDigits(['', '', '', '']);
      setShowSuccessModal(true);
    } catch (err) {
      setPhoneError(getApiErrorMessage(err, 'Invalid OTP. Please try again.'));
    } finally {
      setPhoneBusy(false);
    }
  };

  const handleResendPhoneOtp = async () => {
    if (!phoneSessionId || otpCooldown > 0) return;
    setPhoneBusy(true);
    setPhoneError(null);
    try {
      const res = await resendLinkPhoneOtp(phoneSessionId);
      setOtpCooldown(
        (res as any)?.resendCooldownSeconds ?? (res as any)?.data?.resendCooldownSeconds ?? 30
      );
    } catch (err) {
      setPhoneError(getApiErrorMessage(err, 'Could not resend OTP. Please try again.'));
    } finally {
      setPhoneBusy(false);
    }
  };

  const handlePickAvatar = async () => {
    if (avatarUploading || isUpdatingProfile) return;
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.[0]?.uri) return;
      const asset = picked.assets[0];
      if (asset.size != null && asset.size > 5 * 1024 * 1024) {
        Alert.alert('Image too large', 'Please choose an image under 5 MB.');
        return;
      }
      setAvatarUploading(true);
      const base64 = await uriToBase64(asset.uri);
      const res = await uploadAvatar(base64);
      if (res?.success && res.data) {
        const responseData = res.data as Record<string, any>;
        const url = String(responseData.avatarUrl ?? responseData.avatar ?? '').trim();
        if (url) setAvatarUrl(url);
        applyProfileData(responseData, user as Record<string, any>);
        const mergedUser = {
          ...(user ?? {}),
          ...responseData,
          avatarUrl: url || (user as any)?.avatarUrl,
          avatar: url || (user as any)?.avatar,
        };
        setUser(mergedUser);
        await saveUserData(JSON.stringify(mergedUser));
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      logger.error('Avatar upload failed', err);
      Alert.alert(
        'Upload failed',
        err instanceof Error ? err.message : 'Could not upload photo. Please try again.'
      );
    } finally {
      setAvatarUploading(false);
    }
  };

  const avatarInitial = (name || 'U').trim().charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header title="Profile" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.formContainer, isTablet && styles.formContainerTablet]}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={() => void handlePickAvatar()}
            activeOpacity={0.8}
            disabled={avatarUploading}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{avatarInitial}</Text>
              </View>
            )}
            <View style={styles.avatarBadge}>
              {avatarUploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.avatarBadgeText}>Edit</Text>
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Tap to upload a profile photo</Text>

          {/* Name Input */}
          <View style={styles.inputContainer}>
            <View style={styles.labelContainer}>
              <Text style={[styles.label, { fontSize: rFont(14, 13, 17) }]}>Name*</Text>
            </View>
            <TextInput
              style={[styles.textInput, { fontSize: rFont(14, 13, 17) }]}
              placeholder="Enter Details"
              placeholderTextColor="#6B6B6B"
              value={name}
              onChangeText={setName}
              editable={!isUpdatingProfile}
              textAlignVertical="center"
            />
          </View>

          {/* Mobile Number Input */}
          <View style={styles.inputContainer}>
            <View style={styles.labelContainer}>
              <Text style={[styles.label, { fontSize: rFont(14, 13, 17) }]}>
                Mobile number{phoneLocked || hasLinkedPhone ? '' : '*'}
              </Text>
            </View>
            <View style={[styles.phoneRow, phoneLocked && styles.phoneRowLocked]}>
              <Text style={[styles.phonePrefix, { fontSize: rFont(14, 13, 17) }]}>+91</Text>
              <TextInput
                style={[
                  styles.textInput,
                  styles.phoneInput,
                  phoneLocked && styles.textInputLocked,
                  { fontSize: rFont(14, 13, 17) },
                ]}
                placeholder={phoneLocked ? '' : '10-digit mobile number'}
                placeholderTextColor="#6B6B6B"
                value={mobileNumber}
                onChangeText={(text) => {
                  if (phoneLocked || phoneStep === 'otp') return;
                  setMobileNumber(stripDigits(text).slice(0, 10));
                  setPhoneError(null);
                }}
                keyboardType="phone-pad"
                editable={!phoneLocked && phoneStep !== 'otp' && !isUpdatingProfile && !phoneBusy}
                textAlignVertical="center"
                maxLength={10}
              />
              {phoneLocked ? (
                <View style={styles.lockBadge}>
                  <Ionicons name="lock-closed" size={14} color="#6B6B6B" />
                  <Text style={styles.lockBadgeText}>Verified</Text>
                </View>
              ) : null}
            </View>
            {phoneLocked ? (
              <Text style={[styles.phoneHint, { fontSize: rFont(12, 11, 14) }]}>
                Verified phone numbers cannot be changed. Contact support for account recovery.
              </Text>
            ) : phoneStep === 'otp' ? (
              <View style={styles.otpBlock}>
                <Text style={[styles.phoneHint, { fontSize: rFont(12, 11, 14) }]}>
                  Enter the code sent to +91 {normalizeAuthPhone(mobileNumber)}
                </Text>
                <View style={styles.otpRow}>
                  {otpDigits.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(el) => {
                        otpInputRefs.current[index] = el;
                      }}
                      style={[styles.otpBox, { fontSize: rFont(18, 16, 20) }]}
                      value={digit}
                      onChangeText={(text) => {
                        const nextDigit = stripDigits(text).slice(-1);
                        const next = [...otpDigits];
                        next[index] = nextDigit;
                        setOtpDigits(next);
                        setPhoneError(null);
                        if (nextDigit && index < 3) {
                          otpInputRefs.current[index + 1]?.focus();
                        }
                      }}
                      onKeyPress={({ nativeEvent }) => {
                        if (nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
                          otpInputRefs.current[index - 1]?.focus();
                        }
                      }}
                      keyboardType="number-pad"
                      maxLength={1}
                      editable={!phoneBusy}
                    />
                  ))}
                </View>
                {phoneError ? <Text style={styles.phoneError}>{phoneError}</Text> : null}
                <Text style={[styles.phoneHint, { fontSize: rFont(12, 11, 14) }]}>
                  {otpCooldown > 0 ? `00:${String(otpCooldown).padStart(2, '0')} ` : ''}
                  Didn't get a code?{' '}
                  <Text
                    style={[
                      styles.resendLink,
                      (otpCooldown > 0 || phoneBusy) && styles.resendLinkDisabled,
                    ]}
                    onPress={() => {
                      if (otpCooldown > 0 || phoneBusy) return;
                      void handleResendPhoneOtp();
                    }}
                  >
                    Resend
                  </Text>
                </Text>
                <View style={styles.phoneActions}>
                  <TouchableOpacity
                    style={[styles.secondaryButton, phoneBusy && styles.updateButtonDisabled]}
                    onPress={() => {
                      setPhoneStep('idle');
                      setPhoneError(null);
                    }}
                    disabled={phoneBusy}
                  >
                    <Text style={[styles.secondaryButtonText, { fontSize: rFont(13, 12, 15) }]}>
                      Change number
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.verifyButton, styles.phoneActionFlex, phoneBusy && styles.updateButtonDisabled]}
                    onPress={() => void handleVerifyPhoneOtp()}
                    disabled={phoneBusy}
                  >
                    <Text style={[styles.updateButtonText, { fontSize: rFont(13, 12, 15) }]}>
                      {phoneBusy ? 'Verifying...' : 'Verify Phone Number'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {phoneError ? <Text style={styles.phoneError}>{phoneError}</Text> : null}
                <TouchableOpacity
                  style={[
                    styles.verifyButton,
                    (phoneBusy ||
                      isUpdatingProfile ||
                      !validatePhone(normalizeAuthPhone(mobileNumber), 'IN', 'mobile').valid) &&
                      styles.updateButtonDisabled,
                  ]}
                  onPress={() => void handleSendPhoneOtp()}
                  disabled={
                    phoneBusy ||
                    isUpdatingProfile ||
                    !validatePhone(normalizeAuthPhone(mobileNumber), 'IN', 'mobile').valid
                  }
                  activeOpacity={0.8}
                >
                  <Text style={[styles.updateButtonText, { fontSize: rFont(13, 12, 15) }]}>
                    {phoneBusy
                      ? 'Sending...'
                      : hasLinkedPhone
                        ? 'Verify Phone Number'
                        : 'Add Phone Number'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Email Address Input */}
          <View style={styles.inputContainer}>
            <View style={styles.labelContainer}>
              <Text style={[styles.label, { fontSize: rFont(14, 13, 17) }]}>Email Adress*</Text>
            </View>
            <TextInput
              style={[styles.textInput, { fontSize: rFont(14, 13, 17) }]}
              placeholder="Enter Details"
              placeholderTextColor="#6B6B6B"
              value={emailAddress}
              onChangeText={setEmailAddress}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isUpdatingProfile}
              textAlignVertical="center"
            />
          </View>

          {/* Privacy Message */}
          <Text style={[styles.privacyText, { fontSize: rFont(14, 13, 16) }]}>We promise not spam you</Text>

          {/* Update Button */}
          <TouchableOpacity
            style={[styles.updateButton, isUpdatingProfile && styles.updateButtonDisabled]}
            onPress={handleUpdate}
            disabled={isUpdatingProfile}
            activeOpacity={0.8}
          >
            <Text style={[styles.updateButtonText, { fontSize: rFont(14, 13, 17) }]}>
              {isUpdatingProfile ? 'Updating...' : 'Update'}
            </Text>
          </TouchableOpacity>

          {/* Saved Addresses and Refer & Earn sections removed per requirements */}
        </View>
      </ScrollView>
      
      {/* Success Modal */}
      <ProfileUpdateSuccess
        visible={showSuccessModal}
        onDone={() => setShowSuccessModal(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  formContainer: {
    width: '100%',
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 16,
  },
  formContainerTablet: {
    maxWidth: 520,
    alignSelf: 'center',
  },
  avatarWrap: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 4,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E8E8E8',
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#034703',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#1a7a2c',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 40,
    alignItems: 'center',
  },
  avatarBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  avatarHint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#828282',
    marginBottom: 8,
  },
  inputContainer: {
    width: '100%',
    gap: 8,
  },
  labelContainer: {
    width: '100%',
  },
  label: {
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    color: '#1A1A1A',
    textAlign: 'left',
  },
  textInput: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D4D4D4',
    borderRadius: 3.5,
    paddingTop: 11,
    paddingBottom: 11,
    paddingLeft: 12,
    paddingRight: 12,
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '400',
    textAlign: 'left',
    minHeight: 44,
    includeFontPadding: false,
  },
  phoneRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D4D4D4',
    borderRadius: 3.5,
    paddingLeft: 12,
    paddingRight: 8,
    minHeight: 44,
  },
  phoneRowLocked: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E5E5E5',
  },
  phonePrefix: {
    color: '#6B6B6B',
    fontWeight: '500',
    marginRight: 6,
  },
  phoneInput: {
    flex: 1,
    width: undefined,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingLeft: 0,
    paddingRight: 0,
    minHeight: 42,
  },
  textInputLocked: {
    color: '#6B6B6B',
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEEEEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  lockBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B6B6B',
  },
  phoneHint: {
    color: '#828282',
    marginTop: 6,
  },
  phoneError: {
    color: '#C62828',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  otpBlock: {
    marginTop: 8,
    gap: 10,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  otpBox: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#D4D4D4',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '700',
    color: '#1A1A1A',
  },
  verifyButton: {
    width: '100%',
    backgroundColor: '#034703',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  phoneActions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D4D4D4',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#444444',
    fontWeight: '600',
  },
  phoneActionFlex: {
    flex: 1,
    marginTop: 0,
  },
  resendLink: {
    color: '#034703',
    fontWeight: '700',
  },
  resendLinkDisabled: {
    opacity: 0.45,
  },
  privacyText: {
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 16,
    color: '#828282',
    textAlign: 'left',
  },
  updateButton: {
    width: '100%',
    backgroundColor: '#034703',
    opacity: 0.8,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateButtonDisabled: {
    opacity: 0.5,
  },
  updateButtonText: {
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 24,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  // --- Saved Addresses ---
  savedAddressesSection: {
    gap: 12,
    marginTop: 8,
  },
  savedAddressesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  savedAddressesTitle: {
    fontFamily: 'Inter',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 22,
    color: '#1A1A1A',
  },
  addressesLoadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  addressesList: {
    gap: 10,
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  addressCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(3, 71, 3, 0.08)',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 4,
  },
  addressTagIcon: {
    fontSize: 12,
  },
  addressTagText: {
    fontFamily: 'Inter',
    fontWeight: '600',
    fontSize: 12,
    color: '#034703',
  },
  defaultBadge: {
    backgroundColor: 'rgba(3, 71, 3, 0.06)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  defaultBadgeText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 10,
    color: '#034703',
  },
  addressText: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 18,
    color: '#6B6B6B',
  },
  addressActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 2,
  },
  deleteButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    minWidth: 50,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 12,
    color: '#D32F2F',
  },
  noAddressesContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  noAddressesText: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 13,
    color: '#828282',
  },
  addAddressButton: {
    borderWidth: 1,
    borderColor: '#034703',
    borderRadius: 8,
    borderStyle: 'dashed',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(3, 71, 3, 0.02)',
  },
  addAddressButtonText: {
    fontFamily: 'Inter',
    fontWeight: '600',
    fontSize: 14,
    color: '#034703',
  },

  // --- Referral ---
  referralCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E0F2F1',
  },
  referralTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#034703',
  },
  referralDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: '#4C4C4C',
    lineHeight: 18,
  },
  referralCodeContainer: {
    backgroundColor: '#F0FFF0',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  referralCodeLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#828282',
  },
  referralCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  referralCode: {
    fontSize: 20,
    fontWeight: '700',
    color: '#034703',
    letterSpacing: 2,
  },
  referralShareButton: {
    backgroundColor: '#034703',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  referralShareText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  referralStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  referralStatItem: {
    alignItems: 'center',
    gap: 2,
  },
  referralStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  referralStatLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#828282',
  },
  referralStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E0E0E0',
  },
});

export default Profile;
