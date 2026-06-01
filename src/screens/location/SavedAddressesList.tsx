import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, CommonActions } from '@react-navigation/native';
import type { LocationStackNavigationProp } from '../../types/navigation';
import Header from '../../components/layout/Header';
import LocationIcon from '../../assets/images/location-icon.svg';
import { addressService, Address } from '../../services/address/addressService';
import { useLocation } from '../../contexts/LocationContext';
import { logger } from '@/utils/logger';

const TAG_ICON: Record<string, string> = {
  Home: '🏠',
  Office: '🏢',
  Work: '🏢',
};

const SavedAddressesList: React.FC = () => {
  const navigation = useNavigation<LocationStackNavigationProp>();
  const { setLocation } = useLocation();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const fetchAddresses = useCallback(async () => {
    setLoading(true);
    try {
      const response = await addressService.getAll();
      if (response.success && response.data) {
        setAddresses(response.data);
      }
    } catch (error) {
      logger.error('Error fetching addresses', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAddresses();
    }, [fetchAddresses])
  );

  const goBackToParent = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) {
      parent.goBack();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.dispatch(CommonActions.goBack());
    }
  };

  const handleAddNewAddress = () => {
    navigation.navigate('LocationSearch');
  };

  const handleEditAddress = (address: Address) => {
    navigation.navigate('EnterCompleteAddress', {
      location: {
        title: address.label,
        address: formatAddress(address),
        ...(address.latitude != null &&
          address.longitude != null && {
            latitude: address.latitude,
            longitude: address.longitude,
          }),
      },
      editAddressId: address._id,
      editData: {
        houseNo: address.line1,
        building: address.line2 || '',
        landmark: address.landmark || '',
        label: address.label,
        city: address.city,
        state: address.state || '',
        pincode: address.pincode || '',
        isDefault: address.isDefault,
      },
    });
  };

  const handleDeleteAddress = (id: string) => {
    Alert.alert(
      'Delete Address',
      'Are you sure you want to delete this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(id);
            try {
              const res = await addressService.delete(id);
              if (!res?.success) {
                throw new Error(res?.message || 'Could not delete address');
              }
              setAddresses((prev) => prev.filter((a) => a._id !== id));
            } catch (error) {
              logger.error('Error deleting address', error);
              Alert.alert('Error', 'Could not delete address. Please try again.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  const handleSelectAddress = async (address: Address) => {
    if (address.isDefault) {
      const parts = [address.line1, address.line2, address.landmark, address.city, address.state, address.pincode].filter(Boolean);
      setLocation({
        latitude: address.latitude || 0,
        longitude: address.longitude || 0,
        address: parts.join(', '),
        area: address.city || '',
        city: address.city || '',
        granted: true,
      });
      goBackToParent();
      return;
    }
    setSelectingId(address._id);
    try {
      await addressService.setDefault(address._id);
      setAddresses((prev) =>
        prev.map((a) => ({
          ...a,
          isDefault: a._id === address._id,
        })),
      );

      const parts = [address.line1, address.line2, address.landmark, address.city, address.state, address.pincode].filter(Boolean);
      setLocation({
        latitude: address.latitude || 0,
        longitude: address.longitude || 0,
        address: parts.join(', '),
        area: address.city || '',
        city: address.city || '',
        granted: true,
      });

      goBackToParent();
    } catch (error) {
      logger.error('Error selecting address', error);
      Alert.alert('Error', 'Could not select address. Please try again.');
    } finally {
      setSelectingId(null);
    }
  };

  const formatAddress = (addr: Address) => {
    const parts: string[] = [];
    if (addr.line1) parts.push(addr.line1);
    if (addr.line2) parts.push(addr.line2);
    if (addr.landmark) parts.push(addr.landmark);
    if (addr.city) parts.push(addr.city);
    if (addr.state) parts.push(addr.state);
    if (addr.pincode) parts.push(addr.pincode);
    return parts.join(', ');
  };

  const getTagIcon = (label: string) => TAG_ICON[label] || '📍';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header title="Saved Addresses" onBackPress={goBackToParent} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#034703" />
              <Text style={styles.loadingText}>Loading addresses...</Text>
            </View>
          ) : addresses.length > 0 ? (
            <View style={styles.addressesListContainer}>
              {addresses.map((address) => (
                <View
                  key={address._id}
                  style={[styles.addressCard, address.isDefault && styles.addressCardSelected]}
                >
                  <TouchableOpacity
                    style={styles.addressContentTouchable}
                    onPress={() => handleSelectAddress(address)}
                    activeOpacity={0.7}
                    disabled={selectingId !== null}
                  >
                    <View style={styles.addressContent}>
                      <View style={styles.radioOuter}>
                        {address.isDefault && <View style={styles.radioInner} />}
                      </View>
                      <View style={styles.addressTextContainer}>
                        <View style={styles.titleRow}>
                          <View style={styles.tagBadge}>
                            <Text style={styles.tagIcon}>{getTagIcon(address.label)}</Text>
                            <Text style={styles.addressTitle}>{address.label}</Text>
                          </View>
                          {address.isDefault && (
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultBadgeText}>Default</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.addressContainer}>
                          <Text style={styles.addressText} numberOfLines={2}>
                            {formatAddress(address)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.actionButtonsContainer}>
                    {selectingId === address._id ? (
                      <ActivityIndicator size="small" color="#034703" />
                    ) : (
                      <TouchableOpacity
                        style={[styles.selectButton, address.isDefault && styles.selectButtonActive]}
                        onPress={() => handleSelectAddress(address)}
                        activeOpacity={0.7}
                        disabled={selectingId !== null}
                      >
                        <Text style={[styles.selectButtonText, address.isDefault && styles.selectButtonTextActive]}>
                          {address.isDefault ? 'Selected' : 'Use this'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => handleEditAddress(address)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteActionButton}
                      onPress={() => handleDeleteAddress(address._id)}
                      disabled={deletingId === address._id}
                      activeOpacity={0.7}
                    >
                      {deletingId === address._id ? (
                        <ActivityIndicator size="small" color="#034703" />
                      ) : (
                        <Text style={styles.deleteActionButtonText}>Delete</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyStateContainer}>
              <View style={styles.iconContainer}>
                <LocationIcon width={100} height={100} />
              </View>
              <View style={styles.messageContainer}>
                <Text style={styles.emptyMessage}>No address found</Text>
              </View>
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.button}
              onPress={handleAddNewAddress}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Add New Address</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  addressesListContainer: {
    width: '100%',
    marginBottom: 20,
    gap: 8,
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10.5,
    padding: 20,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  addressCardSelected: {
    borderColor: '#034703',
    backgroundColor: 'rgba(3, 71, 3, 0.02)',
  },
  addressContentTouchable: {
    marginBottom: 16,
  },
  addressContent: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#034703',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#034703',
  },
  addressTextContainer: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tagIcon: {
    fontSize: 14,
  },
  addressTitle: {
    fontFamily: 'Inter',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 24,
    color: '#1A1A1A',
    textAlign: 'left',
  },
  defaultBadge: {
    backgroundColor: 'rgba(3, 71, 3, 0.08)',
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
  addressContainer: {
    width: '100%',
  },
  addressText: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#6B6B6B',
    textAlign: 'left',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    alignItems: 'center',
  },
  selectButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#034703',
    borderRadius: 3.5,
    backgroundColor: 'transparent',
  },
  selectButtonActive: {
    backgroundColor: '#034703',
  },
  selectButtonText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 19.2,
    color: '#034703',
    textAlign: 'center',
  },
  selectButtonTextActive: {
    color: '#FFFFFF',
  },
  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(3, 71, 3, 0.3)',
    borderRadius: 3.5,
  },
  editButtonText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 19.2,
    color: '#034703',
    textAlign: 'center',
  },
  deleteActionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(211, 47, 47, 0.3)',
    borderRadius: 3.5,
    minWidth: 60,
    alignItems: 'center',
  },
  deleteActionButtonText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 19.2,
    color: '#034703',
    textAlign: 'center',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 12,
    paddingVertical: 24,
  },
  iconContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  messageContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyMessage: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 12.25,
    lineHeight: 17.5,
    color: '#666666',
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    marginTop: 'auto',
    paddingTop: 8,
  },
  button: {
    backgroundColor: '#034703',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  loadingText: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 14,
    color: '#828282',
    textAlign: 'center',
    paddingVertical: 4,
  },
});

export default SavedAddressesList;
