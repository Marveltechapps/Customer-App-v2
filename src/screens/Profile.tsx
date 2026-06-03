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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/layout/Header';
import ProfileUpdateSuccess from './ProfileUpdateSuccess';
import { logger } from '@/utils/logger';
import { getProfile, updateProfile } from '../services/profile/profileService';
import { useUser } from '../contexts/UserContext';
import { saveUserData } from '../utils/storage';

const Profile: React.FC = () => {
  const { user, setUser } = useUser();
  const userRef = useRef(user);
  const [name, setName] = useState<string>('');
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [emailAddress, setEmailAddress] = useState<string>('');
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const lastFetchAtRef = useRef(0);

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
    setMobileNumber(
      firstNonEmpty(
        raw.phoneNumber,
        raw.mobileNumber,
        raw.phone,
        raw.mobile,
        savedCheckoutContact.phone,
        fallback?.phoneNumber,
        fallback?.mobileNumber,
        fallback?.phone,
        fallback?.mobile,
        fallbackSavedCheckoutContact.phone
      )
    );
    const resolvedEmail = firstNonEmpty(
      normalizeEmail(raw.email),
      normalizeEmail(raw.emailAddress),
      normalizeEmail(savedCheckoutContact.email),
      normalizeEmail(fallback?.email),
      normalizeEmail(fallback?.emailAddress),
      normalizeEmail(fallbackSavedCheckoutContact.email)
    );
    setEmailAddress(resolvedEmail);
  };

  useEffect(() => {
    if (user) {
      applyProfileData(user as Record<string, any>, null);
    }
  }, [user]);

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
      const normalizedPhone = mobileNumber.replace(/\s/g, '');
      logger.info('[profile] update submit', {
        payload: { name: trimmedName, email: trimmedEmail, phoneNumber: normalizedPhone },
      });
      const optimisticUser = {
        ...(userRef.current ?? {}),
        name: trimmedName || (userRef.current as Record<string, any> | null)?.name,
        email: trimmedEmail || (userRef.current as Record<string, any> | null)?.email,
        phoneNumber:
          normalizedPhone ||
          (userRef.current as Record<string, any> | null)?.phoneNumber ||
          (userRef.current as Record<string, any> | null)?.mobileNumber,
        mobileNumber:
          normalizedPhone ||
          (userRef.current as Record<string, any> | null)?.mobileNumber ||
          (userRef.current as Record<string, any> | null)?.phoneNumber,
        savedCheckoutContact: {
          ...(((userRef.current as Record<string, any> | null)?.savedCheckoutContact ?? {}) as Record<string, any>),
          fullName: trimmedName || undefined,
          email: trimmedEmail || undefined,
          phone: normalizedPhone || undefined,
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
        savedCheckoutContact: {
          fullName: trimmedName || undefined,
          email: trimmedEmail || undefined,
          phone: normalizedPhone || undefined,
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
        applyProfileData(responseData);
        const mergedUser = {
          ...(optimisticUser ?? {}),
          ...responseData,
          name: trimmedName || responseData.name || responseData.fullName,
          email: trimmedEmail || responseData.email || responseData.emailAddress,
          phoneNumber:
            normalizedPhone ||
            responseData.phoneNumber ||
            responseData.mobileNumber ||
            responseData.phone,
          mobileNumber:
            normalizedPhone ||
            responseData.mobileNumber ||
            responseData.phoneNumber ||
            responseData.phone,
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header title="Profile" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formContainer}>
          {/* Name Input */}
          <View style={styles.inputContainer}>
            <View style={styles.labelContainer}>
              <Text style={styles.label}>Name*</Text>
            </View>
            <TextInput
              style={styles.textInput}
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
              <Text style={styles.label}>Mobile number*</Text>
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="Enter Details"
              placeholderTextColor="#6B6B6B"
              value={mobileNumber}
              onChangeText={setMobileNumber}
              keyboardType="phone-pad"
              editable={!isUpdatingProfile}
              textAlignVertical="center"
            />
          </View>

          {/* Email Address Input */}
          <View style={styles.inputContainer}>
            <View style={styles.labelContainer}>
              <Text style={styles.label}>Email Adress*</Text>
            </View>
            <TextInput
              style={styles.textInput}
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
          <Text style={styles.privacyText}>We promise not spam you</Text>

          {/* Update Button */}
          <TouchableOpacity
            style={[styles.updateButton, isUpdatingProfile && styles.updateButtonDisabled]}
            onPress={handleUpdate}
            disabled={isUpdatingProfile}
            activeOpacity={0.8}
          >
            <Text style={styles.updateButtonText}>
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
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 16,
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
