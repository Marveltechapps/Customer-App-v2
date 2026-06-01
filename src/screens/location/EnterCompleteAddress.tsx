import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { LocationStackNavigationProp } from '../../types/navigation';
import Header from '../../components/layout/Header';
import AddressSavedSuccess from './AddressSavedSuccess';
import MapPinIcon from '../../assets/images/map-pin-4-alt.svg';
import { useLocation } from '../../contexts/LocationContext';
import { logger } from '@/utils/logger';
import { getApiErrorMessage } from '../../services/api/types';
import { addressService } from '../../services/address/addressService';

interface AddressFormData {
  houseNo: string;
  building: string;
  landmark: string;
  label: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

const ADDRESS_LABELS = ['Home', 'Work', 'Other'] as const;

const EnterCompleteAddress: React.FC = () => {
  const navigation = useNavigation<LocationStackNavigationProp>();
  const route = useRoute();
  const { setLocation } = useLocation();

  const params = route.params as {
    location?: {
      title: string;
      address: string;
      city?: string;
      state?: string;
      pincode?: string;
      area?: string;
      latitude?: number;
      longitude?: number;
    };
    editAddressId?: string;
    editData?: {
      houseNo: string;
      building: string;
      landmark: string;
      label: string;
      city: string;
      state: string;
      pincode: string;
      isDefault?: boolean;
    };
  } | undefined;

  const location = params?.location || {
    title: 'Location',
    address: '',
    city: '',
    state: '',
    pincode: '',
    area: '',
  };
  const editAddressId = params?.editAddressId;
  const editData = params?.editData;

  const [showSuccess, setShowSuccess] = useState(false);
  const [formData, setFormData] = useState<AddressFormData>({
    houseNo: editData?.houseNo || '',
    building: editData?.building || '',
    landmark: editData?.landmark || location.area || '',
    label: editData?.label || 'Home',
    city: editData?.city || location.city || '',
    state: editData?.state || location.state || '',
    pincode: editData?.pincode || location.pincode || '',
    isDefault: editData?.isDefault || false,
  });
  const [customLabel, setCustomLabel] = useState(
    editData?.label && !['Home', 'Work', 'Other'].includes(editData.label)
      ? editData.label
      : '',
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editData?.label && !['Home', 'Work', 'Other'].includes(editData.label)) {
      setFormData((prev) => ({ ...prev, label: 'Other' }));
      setCustomLabel(editData.label);
    }
  }, [editData?.label]);

  const handleInputChange = (field: keyof AddressFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLabelSelect = (label: string) => {
    setFormData((prev) => ({ ...prev, label }));
    if (label !== 'Other') {
      setCustomLabel('');
    }
  };

  const handleSave = async () => {
    const line1 = formData.houseNo.trim();
    if (!line1) {
      Alert.alert('Required', 'Please enter house number / floor.');
      return;
    }

    const finalLabel =
      formData.label === 'Other' ? (customLabel.trim() || 'Other') : formData.label;

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        label: finalLabel,
        line1,
        line2: formData.building.trim() || undefined,
        landmark: formData.landmark.trim() || undefined,
        city: formData.city.trim() || location.city || 'Unknown',
        state: formData.state.trim() || undefined,
        pincode: formData.pincode.trim() || undefined,
        isDefault: formData.isDefault,
      };

      if ((location as any).latitude != null) payload.latitude = (location as any).latitude;
      if ((location as any).longitude != null) payload.longitude = (location as any).longitude;

      let savedAddress;
      if (editAddressId) {
        const res = await addressService.update(editAddressId, payload);
        if (!res?.success || !res.data) {
          throw new Error(res?.message || 'Could not update address');
        }
        savedAddress = res.data;
      } else {
        const res = await addressService.create(payload);
        if (!res?.success || !res.data) {
          throw new Error(res?.message || 'Could not save address');
        }
        savedAddress = res.data;
      }

      // If this is the default address, update the LocationContext
      if (savedAddress && (savedAddress.isDefault || !editAddressId)) {
        const parts = [savedAddress.line1, savedAddress.line2, savedAddress.landmark, savedAddress.city, savedAddress.state, savedAddress.pincode].filter(Boolean);
        setLocation({
          latitude: savedAddress.latitude || 0,
          longitude: savedAddress.longitude || 0,
          address: parts.join(', '),
          area: savedAddress.city || '',
          city: savedAddress.city || '',
          granted: true,
        });
      }

      setShowSuccess(true);
    } catch (error) {
      logger.error('Error saving address', error);
      Alert.alert(
        'Error',
        getApiErrorMessage(error, 'Could not save address. Please try again.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChangeLocation = () => {
    navigation.navigate('LocationSearch');
  };

  const handleSuccessDone = () => {
    setShowSuccess(false);
    navigation.navigate('SavedAddressesList');
  };

  const isOtherActive = formData.label === 'Other' ||
    (!['Home', 'Work'].includes(formData.label) && formData.label !== 'Other');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header title="Enter complete address" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentContainer}>
          {/* Location Card */}
          <View style={styles.locationCard}>
            <View style={styles.locationCardContent}>
              <View style={styles.locationIconContainer}>
                <MapPinIcon width={20} height={20} />
              </View>
              <View style={styles.locationTextContainer}>
                <View style={styles.locationTitleContainer}>
                  <Text style={styles.locationTitle}>{location.title}</Text>
                </View>
                <View style={styles.locationAddressContainer}>
                  <Text style={styles.locationAddress} numberOfLines={2}>
                    {location.address}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={styles.changeButton}
              onPress={handleChangeLocation}
              activeOpacity={0.7}
            >
              <Text style={styles.changeButtonText}>Change</Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.formCard}>
            <View style={styles.inputContainer}>
              <View style={styles.labelContainer}>
                <Text style={styles.label}>House No. & Floor *</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter Details"
                placeholderTextColor="#6B6B6B"
                value={formData.houseNo}
                onChangeText={(value) => handleInputChange('houseNo', value)}
              />
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.labelContainer}>
                <Text style={styles.label}>Building & Block No.</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter Details"
                placeholderTextColor="#6B6B6B"
                value={formData.building}
                onChangeText={(value) => handleInputChange('building', value)}
              />
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.labelContainer}>
                <Text style={styles.label}>Landmark & Area name (Optional)</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter Details"
                placeholderTextColor="#6B6B6B"
                value={formData.landmark}
                onChangeText={(value) => handleInputChange('landmark', value)}
              />
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.labelContainer}>
                <Text style={styles.label}>City</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter City"
                placeholderTextColor="#6B6B6B"
                value={formData.city}
                onChangeText={(value) => handleInputChange('city', value)}
              />
            </View>

            <View style={styles.rowInputs}>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <View style={styles.labelContainer}>
                  <Text style={styles.label}>State</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter State"
                  placeholderTextColor="#6B6B6B"
                  value={formData.state}
                  onChangeText={(value) => handleInputChange('state', value)}
                />
              </View>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <View style={styles.labelContainer}>
                  <Text style={styles.label}>Pincode</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter Pincode"
                  placeholderTextColor="#6B6B6B"
                  value={formData.pincode}
                  onChangeText={(value) => handleInputChange('pincode', value)}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
            </View>
          </View>

          {/* Address Label Selection */}
          <View style={styles.labelCard}>
            <View style={styles.labelSectionHeader}>
              <Text style={styles.labelSectionTitle}>Add Address Label</Text>
            </View>
            <View style={styles.labelButtonsContainer}>
              {ADDRESS_LABELS.map((label) => {
                const isActive =
                  label === 'Other' ? isOtherActive : formData.label === label;
                return (
                  <TouchableOpacity
                    key={label}
                    style={[
                      styles.labelButton,
                      isActive && styles.labelButtonActive,
                    ]}
                    onPress={() => handleLabelSelect(label)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.labelButtonText,
                        isActive && styles.labelButtonTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {isOtherActive && (
              <TextInput
                style={styles.customLabelInput}
                placeholder="Enter custom label"
                placeholderTextColor="#6B6B6B"
                value={customLabel}
                onChangeText={setCustomLabel}
                maxLength={30}
              />
            )}
          </View>

          {/* Set as Default Checkbox */}
          <TouchableOpacity
            style={styles.defaultCheckboxContainer}
            onPress={() => setFormData(prev => ({ ...prev, isDefault: !prev.isDefault }))}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, formData.isDefault && styles.checkboxActive]}>
              {formData.isDefault && <View style={styles.checkboxInner} />}
            </View>
            <Text style={styles.defaultCheckboxText}>Set as default address</Text>
          </TouchableOpacity>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            activeOpacity={0.8}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>
                {editAddressId ? 'Update Address' : 'Save Address'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      <AddressSavedSuccess visible={showSuccess} onDone={handleSuccessDone} />
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
  contentContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 24,
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10.5,
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  locationCardContent: {
    flexDirection: 'row',
    gap: 12,
  },
  locationIconContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationTextContainer: {
    flex: 1,
    gap: 4,
  },
  locationTitleContainer: {
    width: '100%',
  },
  locationTitle: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24,
    color: '#1A1A1A',
    textAlign: 'left',
  },
  locationAddressContainer: {
    width: '100%',
  },
  locationAddress: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#6B6B6B',
    textAlign: 'left',
  },
  changeButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(3, 71, 3, 0.3)',
    borderRadius: 3.5,
  },
  changeButtonText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 19.2,
    color: '#034703',
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10.5,
    padding: 16,
    gap: 16,
  },
  inputContainer: {
    width: '100%',
    gap: 4,
  },
  labelContainer: {
    width: '100%',
    paddingBottom: 4,
  },
  label: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 18,
    color: '#1A1A1A',
    textAlign: 'left',
  },
  input: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#D4D4D4',
    borderRadius: 3.5,
    paddingVertical: 11,
    paddingHorizontal: 12,
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#1A1A1A',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  labelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10.5,
    padding: 16,
    gap: 12,
  },
  labelSectionHeader: {
    width: '100%',
  },
  labelSectionTitle: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    color: '#1A1A1A',
    textAlign: 'left',
  },
  labelButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  labelButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#D4D4D4',
    borderRadius: 3.5,
    backgroundColor: '#FFFFFF',
  },
  labelButtonActive: {
    backgroundColor: 'rgba(3, 71, 3, 0.1)',
    borderColor: '#034703',
  },
  labelButtonText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 19.2,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  labelButtonTextActive: {
    color: '#034703',
  },
  defaultCheckboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#034703',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#FFFFFF',
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#034703',
  },
  defaultCheckboxText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 14,
    color: '#1A1A1A',
  },
  customLabelInput: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#D4D4D4',
    borderRadius: 3.5,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: 'Inter',
    fontSize: 13,
    color: '#1A1A1A',
  },
  saveButton: {
    backgroundColor: '#034703',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

export default EnterCompleteAddress;
