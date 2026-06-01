import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { LocationStackNavigationProp } from '../../types/navigation';
import Header from '../../components/layout/Header';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { logger } from '@/utils/logger';

interface LocationData {
  title: string;
  address: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  useGPS?: boolean;
}

const MapAddressPin: React.FC = () => {
  const navigation = useNavigation<LocationStackNavigationProp>();
  const route = useRoute();
  const routeLocation = (route.params as { location?: LocationData })?.location;

  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    title: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    area: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchGPSLocation = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        logger.warn('Location permission not granted');
        setLoading(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = position.coords;

      let address = '';
      let area = '';
      let city = '';
      let state = '';
      let pincode = '';

      try {
        const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geocoded.length > 0) {
          const place = geocoded[0];
          const parts: string[] = [];
          if (place.name) parts.push(place.name);
          if (place.street) parts.push(place.street);
          if (place.district) parts.push(place.district);
          if (place.city) parts.push(place.city);
          if (place.region) parts.push(place.region);
          address = parts.join(', ');
          area = place.district || place.subregion || place.name || '';
          city = place.city || place.region || '';
          state = place.region || '';
          pincode = place.postalCode || '';
        }
      } catch {
        address = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      }

      setCurrentLocation({
        latitude,
        longitude,
        title: area || 'Your Location',
        address,
        city,
        state,
        pincode,
        area,
      });
    } catch (error) {
      logger.error('Error getting GPS location', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (routeLocation?.useGPS || !routeLocation?.latitude) {
      fetchGPSLocation();
    } else if (routeLocation?.latitude && routeLocation?.longitude) {
      setCurrentLocation({
        latitude: routeLocation.latitude,
        longitude: routeLocation.longitude,
        title: routeLocation.title || 'Selected Location',
        address: routeLocation.address || '',
        city: routeLocation.city || '',
        state: '',
        pincode: '',
        area: '',
      });
      setLoading(false);
    } else {
      fetchGPSLocation();
    }
  }, [routeLocation, fetchGPSLocation]);

  const handleRegionChange = useCallback(async (region: Region) => {
    try {
      const geocoded = await Location.reverseGeocodeAsync({
        latitude: region.latitude,
        longitude: region.longitude,
      });
      if (geocoded.length > 0) {
        const place = geocoded[0];
        const parts: string[] = [];
        if (place.name) parts.push(place.name);
        if (place.street) parts.push(place.street);
        if (place.district) parts.push(place.district);
        if (place.city) parts.push(place.city);
        if (place.region) parts.push(place.region);

        setCurrentLocation({
          latitude: region.latitude,
          longitude: region.longitude,
          title: place.district || place.subregion || place.name || 'Selected Location',
          address: parts.join(', '),
          city: place.city || place.region || '',
          state: place.region || '',
          pincode: place.postalCode || '',
          area: place.district || place.subregion || place.name || '',
        });
      }
    } catch {
      setCurrentLocation((prev) =>
        prev
          ? { ...prev, latitude: region.latitude, longitude: region.longitude }
          : null,
      );
    }
  }, []);

  const handleConfirm = () => {
    if (!currentLocation) return;
    navigation.navigate('EnterCompleteAddress', {
      location: {
        title: currentLocation.title,
        address: currentLocation.address,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        city: currentLocation.city,
        state: currentLocation.state,
        pincode: currentLocation.pincode,
        area: currentLocation.area,
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.headerContainer}>
          <Header title="" />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#034703" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentLocation) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.headerContainer}>
          <Header title="" />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Could not get location. Please try again.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchGPSLocation} activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.headerContainer}>
        <Header title="" />
      </View>
      <View style={styles.mapContainer}>
        <MapView
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          style={styles.map}
          initialRegion={{
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          onRegionChangeComplete={handleRegionChange}
        >
          <Marker
            coordinate={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            }}
            title={currentLocation.title}
            description={currentLocation.address}
          >
            <View style={styles.customMarker}>
              <View style={styles.markerDot} />
              <View style={styles.markerTail} />
            </View>
          </Marker>
        </MapView>

        {/* Info card at top */}
        <View style={styles.infoCard}>
          <View style={styles.infoCardContent}>
            <Text style={styles.infoCardTitle}>Order will be Delivered here</Text>
            <Text style={styles.infoCardSubtitle}>
              Place the Pin to your exact Location
            </Text>
          </View>
        </View>

        {/* Location card at bottom */}
        <View style={styles.locationCard}>
          <View style={styles.locationCardContent}>
            <View style={styles.locationIconContainer}>
              <View style={styles.locationPinHead}>
                <View style={styles.locationPinDot} />
              </View>
              <View style={styles.locationPinTail} />
            </View>
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationTitle} numberOfLines={1}>
                {currentLocation.title}
              </Text>
              <Text style={styles.locationAddress} numberOfLines={2}>
                {currentLocation.address}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirm}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmButtonText}>Confirm & proceed</Text>
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
  headerContainer: {
    width: '100%',
    paddingHorizontal: 16,
  },
  mapContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 14,
    color: '#6B6B6B',
  },
  errorText: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 14,
    color: '#034703',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    backgroundColor: '#034703',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  retryButtonText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 14,
    color: '#FFFFFF',
  },
  customMarker: {
    alignItems: 'center',
  },
  markerDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#034703',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  markerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#034703',
    marginTop: -2,
  },
  infoCard: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    backgroundColor: '#007D00',
    borderRadius: 10.5,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 10,
  },
  infoCardContent: {
    gap: 8,
    paddingHorizontal: 19,
  },
  infoCardTitle: {
    fontFamily: 'Inter',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  infoCardSubtitle: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  locationCard: {
    position: 'absolute',
    bottom: 20,
    left: 14,
    right: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 10.5,
    padding: 16,
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 10,
  },
  locationCardContent: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  locationIconContainer: {
    alignItems: 'center',
    marginTop: 2,
  },
  locationPinHead: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#034703',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationPinDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FFFFFF',
  },
  locationPinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#034703',
    marginTop: -1,
  },
  locationTextContainer: {
    flex: 1,
    gap: 4,
  },
  locationTitle: {
    fontFamily: 'Inter',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 24,
    color: '#1A1A1A',
    textAlign: 'left',
  },
  locationAddress: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    textAlign: 'left',
  },
  confirmButton: {
    backgroundColor: '#034703',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

export default MapAddressPin;
