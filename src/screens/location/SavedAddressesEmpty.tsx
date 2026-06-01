import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { LocationStackNavigationProp } from '../../types/navigation';
import Header from '../../components/layout/Header';
import LocationIcon from '../../assets/images/location-icon.svg';
import { addressService } from '../../services/address/addressService';
import { logger } from '@/utils/logger';

const SavedAddressesEmpty: React.FC = () => {
  const navigation = useNavigation<LocationStackNavigationProp>();
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const fetchAddresses = async () => {
        setLoading(true);
        try {
          const response = await addressService.getAll();
          if (response.success && response.data && response.data.length > 0) {
            navigation.replace('SavedAddressesList');
            return;
          }
        } catch (error) {
          logger.error('Error fetching addresses', error);
        } finally {
          setLoading(false);
        }
      };

      fetchAddresses();
    }, [navigation])
  );

  const handleAddNewAddress = () => {
    navigation.navigate('LocationSearch');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Header title="Saved Addresses" />
        <View style={styles.contentContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header title="Saved Addresses" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentContainer}>
          <View style={styles.emptyStateContainer}>
            <View style={styles.iconContainer}>
              <LocationIcon width={100} height={100} />
            </View>
            <View style={styles.messageContainer}>
              <Text style={styles.emptyMessage}>No address Found</Text>
            </View>
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
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 12,
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
    paddingVertical: 20,
  },
});

export default SavedAddressesEmpty;
