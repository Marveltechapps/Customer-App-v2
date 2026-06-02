import React, { useState, useCallback } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '../types/navigation';
import Header from '../components/layout/Header';
import ProfileUpdateSuccess from './ProfileUpdateSuccess';
import { logger } from '@/utils/logger';
import { userService } from '../services/user/userService';
import { api } from '../services/api/client';
import { endpoints } from '../services/api/endpoints';

interface ProfileData {
  name: string;
  mobileNumber: string;
  emailAddress: string;
}

const Profile: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const [name, setName] = useState<string>('');
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [emailAddress, setEmailAddress] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const fetchProfileData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await userService.getProfile();
      const data = (res as any)?.data ?? res;
      if (data) {
        setName(data.name ?? data.fullName ?? '');
        setMobileNumber(data.mobileNumber ?? data.phone ?? data.mobile ?? '');
        setEmailAddress(data.emailAddress ?? data.email ?? '');
      }
    } catch (error) {
      logger.error('Error fetching profile data', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useRefreshOnFocus(() => {
    void fetchProfileData();
  }, [fetchProfileData]);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await api.put(endpoints.user.updateProfile, { name, emailAddress });
      setShowSuccessModal(true);
    } catch (error) {
      logger.error('Error updating profile', error);
    } finally {
      setLoading(false);
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
              editable={!loading}
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
              editable={!loading}
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
              editable={!loading}
              textAlignVertical="center"
            />
          </View>

          {/* Privacy Message */}
          <Text style={styles.privacyText}>We promise not spam you</Text>

          {/* Update Button */}
          <TouchableOpacity
            style={[styles.updateButton, loading && styles.updateButtonDisabled]}
            onPress={handleUpdate}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.updateButtonText}>
              {loading ? 'Updating...' : 'Update'}
            </Text>
          </TouchableOpacity>

          {/* Coupons & Offers Link */}
          <TouchableOpacity
            style={styles.offersLink}
            onPress={() => navigation.navigate('Coupons')}
            activeOpacity={0.7}
          >
            <View style={styles.offersLinkContent}>
              <Text style={styles.offersLinkTitle}>Coupons & Offers</Text>
              <Text style={styles.offersLinkSubtitle}>View all available discount codes</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
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
  offersLink: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 8,
  },
  offersLinkContent: {
    gap: 4,
  },
  offersLinkTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  offersLinkSubtitle: {
    fontSize: 12,
    color: '#6B6B6B',
  },
  chevron: {
    fontSize: 24,
    color: '#D1D1D1',
    fontWeight: '300',
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
