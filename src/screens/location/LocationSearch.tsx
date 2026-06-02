import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus';
import type { LocationStackNavigationProp } from '../../types/navigation';
import Header from '../../components/layout/Header';
import SearchIcon from '../../assets/images/search-icon.svg';
import CurrentLocationIcon from '../../assets/images/current-location-icon.svg';
import MapPinIcon from '../../assets/images/map-pin.svg';
import { addressService, Address } from '../../services/address/addressService';
import { logger } from '@/utils/logger';
import { subscribeAddressesChanged } from '../../utils/addressRefresh';

const TAG_ICON: Record<string, string> = {
  Home: '🏠',
  Office: '🏢',
  Work: '🏢',
};

const LocationSearch: React.FC = () => {
  const navigation = useNavigation<LocationStackNavigationProp>();
  const [searchQuery, setSearchQuery] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSavedAddresses = useCallback(async () => {
    setLoading(true);
    try {
      const response = await addressService.getAll();
      if (response.success && response.data) {
        setSavedAddresses(response.data);
      } else {
        setSavedAddresses([]);
      }
    } catch (error) {
      logger.error('Error fetching saved addresses', error);
      setSavedAddresses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useRefreshOnFocus(() => {
    void fetchSavedAddresses();
  }, [fetchSavedAddresses]);

  useEffect(() => {
    return subscribeAddressesChanged(() => {
      void fetchSavedAddresses();
    });
  }, [fetchSavedAddresses]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text.length > 0) {
      navigation.navigate('LocationSearchResults', { searchQuery: text });
    }
  };

  const handleCurrentLocation = () => {
    navigation.navigate('MapAddressPin', {
      location: { title: 'Current Location', address: 'Using GPS', useGPS: true },
    });
  };

  const handleSavedAddressSelect = (address: Address) => {
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
      <Header title="Select your location" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentContainer}>
          <View style={styles.searchSection}>
            <View style={styles.searchRow}>
              <View style={styles.searchInputContainer}>
                <View style={styles.searchIconContainer}>
                  <SearchIcon width={16} height={16} />
                </View>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search an area or address"
                  placeholderTextColor="#6B6B6B"
                  value={searchQuery}
                  onChangeText={handleSearch}
                />
              </View>
              <TouchableOpacity
                style={styles.currentLocationButton}
                onPress={handleCurrentLocation}
                activeOpacity={0.8}
              >
                <View style={styles.currentLocationIconContainer}>
                  <CurrentLocationIcon width={20} height={20} />
                </View>
                <View style={styles.currentLocationTextContainer}>
                  <View style={styles.currentLocationTitleContainer}>
                    <Text style={styles.currentLocationTitle}>Current Location</Text>
                  </View>
                  <View style={styles.currentLocationMethodContainer}>
                    <Text style={styles.currentLocationMethod}>Using GPS</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.savedAddressesSection}>
              <View style={styles.savedAddressesHeadingContainer}>
                <Text style={styles.savedAddressesHeading}>
                  SAVED ADDRESSES
                </Text>
              </View>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#034703" />
                </View>
              ) : savedAddresses.length > 0 ? (
                <View style={styles.savedAddressesList}>
                  {savedAddresses.map((address) => (
                    <TouchableOpacity
                      key={address._id}
                      style={styles.savedAddressItem}
                      onPress={() => handleSavedAddressSelect(address)}
                      activeOpacity={0.7}
                    >
                      <MapPinIcon width={20} height={20} />
                      <View style={styles.savedAddressTextContainer}>
                        <View style={styles.savedAddressTitleRow}>
                          <Text style={styles.savedAddressIcon}>{getTagIcon(address.label)}</Text>
                          <Text style={styles.savedAddressTitle}>{address.label}</Text>
                          {address.isDefault && (
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultBadgeText}>Default</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.savedAddressText} numberOfLines={2}>
                          {formatAddress(address)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.noAddressesContainer}>
                  <Text style={styles.noAddressesText}>No saved addresses</Text>
                </View>
              )}
            </View>
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
    gap: 24,
  },
  searchSection: {
    width: '100%',
    gap: 16,
  },
  searchRow: {
    width: '100%',
    gap: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D1D1',
    borderRadius: 8.5,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  searchIconContainer: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    color: '#1A1A1A',
  },
  currentLocationButton: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D1D1',
    borderRadius: 10.5,
    padding: 12,
    alignItems: 'center',
  },
  currentLocationIconContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentLocationTextContainer: {
    flex: 1,
    gap: 4,
  },
  currentLocationTitleContainer: {
    width: '100%',
  },
  currentLocationTitle: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24,
    color: '#00A400',
    textAlign: 'left',
  },
  currentLocationMethodContainer: {
    width: '100%',
  },
  currentLocationMethod: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#00A400',
    textAlign: 'left',
  },
  savedAddressesSection: {
    width: '100%',
    gap: 12,
  },
  savedAddressesHeadingContainer: {
    width: '100%',
  },
  savedAddressesHeading: {
    fontFamily: 'Inter',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 16.8,
    color: '#6B6B6B',
    textAlign: 'left',
  },
  savedAddressesList: {
    width: '100%',
    gap: 12,
  },
  savedAddressItem: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 10.5,
    borderWidth: 1,
    borderColor: '#D1D1D1',
  },
  savedAddressTextContainer: {
    flex: 1,
    gap: 4,
  },
  savedAddressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savedAddressIcon: {
    fontSize: 14,
  },
  savedAddressTitle: {
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
    paddingHorizontal: 6,
    borderRadius: 8,
    marginLeft: 4,
  },
  defaultBadgeText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 10,
    color: '#034703',
  },
  savedAddressText: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#6B6B6B',
    textAlign: 'left',
  },
  noAddressesContainer: {
    width: '100%',
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  noAddressesText: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 22.4,
    color: '#6B6B6B',
    textAlign: 'center',
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default LocationSearch;
