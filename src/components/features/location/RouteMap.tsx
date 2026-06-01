/**
 * RouteMap Component
 * 
 * Displays a map with the user's current location and a route
 * to the delivery destination using Google Maps.
 * 
 * @format
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  ActivityIndicator, 
  Text, 
  Platform, 
  Linking, 
  TouchableOpacity
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { logger } from '@/utils/logger';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || Constants.expoConfig?.extra?.googleMapsApiKey;

export interface RouteInfo {
  distanceKm: number;
  durationMinutes: number;
}

interface RouteMapProps {
  deliveryAddress: string;
  deliveryCoordinates?: {
    latitude: number;
    longitude: number;
  };
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  /** Driver/rider coordinates for real-time tracking */
  driverCoordinates?: {
    latitude: number;
    longitude: number;
  };
  height?: number;
  /** Show an ETA / distance badge overlay on the map */
  showRouteInfo?: boolean;
  /** When 'distanceOnly', badge shows only distance in one line (no ETA) */
  routeInfoDisplay?: 'both' | 'distanceOnly';
  /** Callback with route distance & duration once available */
  onRouteInfo?: (info: RouteInfo) => void;
  /** Custom label for the origin marker */
  originLabel?: string;
  /** Custom label for the destination marker */
  destinationLabel?: string;
}

interface Location {
  latitude: number;
  longitude: number;
}


const RouteMap: React.FC<RouteMapProps> = ({
  deliveryAddress,
  deliveryCoordinates,
  currentLocation: providedCurrentLocation,
  driverCoordinates,
  height = 200,
  showRouteInfo = false,
  routeInfoDisplay = 'both',
  onRouteInfo,
  originLabel,
  destinationLabel,
}) => {
  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <View style={[styles.container, styles.errorContainer, { height }]}>
        <View style={styles.errorContent}>
          <Text style={styles.errorTitle}>Configuration Error</Text>
          <Text style={styles.errorText}>
            Google Maps API key is not configured. Please set GOOGLE_MAPS_API_KEY in your .env file and rebuild the app.
          </Text>
        </View>
      </View>
    );
  }

  const mapRef = useRef<MapView>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(
    providedCurrentLocation || null
  );
  const [destination, setDestination] = useState<Location | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(!providedCurrentLocation);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'permission' | 'unavailable' | 'timeout' | 'other' | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(!!providedCurrentLocation);

  // Open device settings
  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  // Request location permission
  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setHasLocationPermission(true);
        getCurrentLocation();
      } else {
        setHasLocationPermission(false);
        setErrorType('permission');
        setError('Location permission denied. Please enable it in Settings.');
        setLoading(false);
      }
    } catch (err) {
      logger.error('Error requesting location permission', err);
      setErrorType('other');
      setError('Failed to request location permission');
      setLoading(false);
    }
  };

  // Update current location if provided as prop changes
  useEffect(() => {
    if (providedCurrentLocation) {
      setCurrentLocation(providedCurrentLocation);
      setHasLocationPermission(true);
      setLoading(false);
      initializeMap(providedCurrentLocation);
    }
  }, [providedCurrentLocation]);

  // Request location permission on mount only if location is not provided
  useEffect(() => {
    if (!providedCurrentLocation) {
      requestLocationPermission();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get current location with improved error handling
  const getCurrentLocation = async () => {
    setLoading(true);
    setError(null);
    setErrorType(null);

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const locationData: Location = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setCurrentLocation(locationData);
      setHasLocationPermission(true);
      initializeMap(locationData);
    } catch (error: any) {
      logger.error('Error getting location', error);
      
      // Handle specific error types
      if (error.code === 'E_LOCATION_UNAVAILABLE') {
        setErrorType('unavailable');
        setError('Location information is unavailable');
      } else if (error.code === 'E_LOCATION_TIMEOUT') {
        setErrorType('timeout');
        setError('Location request timed out');
      } else if (error.code === 'E_LOCATION_PERMISSION_DENIED') {
        setErrorType('permission');
        setError('Location permission denied');
      } else {
        setErrorType('other');
        setError('Failed to get current location');
      }
      
      setLoading(false);
    }
  };

  // Retry getting location
  const handleRetry = async () => {
    try {
      await requestLocationPermission();
    } catch (error) {
      logger.error('Error retrying location permission', error);
      setError('Failed to request location permission. Please try again.');
    }
  };

  const geocodeAddress = async (address: string): Promise<Location | null> => {
    if (!address || !address.trim()) return null;

    // Try expo-location geocoding first (works without Google API key)
    try {
      const results = await Location.geocodeAsync(address);
      if (results && results.length > 0) {
        return {
          latitude: results[0].latitude,
          longitude: results[0].longitude,
        };
      }
    } catch (expoErr) {
      logger.warn('Expo geocoding unavailable, trying Google Maps API', expoErr);
    }

    // Fallback to Google Maps Geocoding API
    if (GOOGLE_MAPS_API_KEY) {
      try {
        const encodedAddress = encodeURIComponent(address);
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`
        );
        const data = await response.json();

        if (data.status === 'OK' && data.results?.length > 0) {
          const loc = data.results[0].geometry.location;
          return { latitude: loc.lat, longitude: loc.lng };
        }
        logger.warn('Google geocoding returned status:', data.status);
      } catch (googleErr) {
        logger.warn('Google geocoding failed', googleErr);
      }
    }

    return null;
  };

  // Initialize map with both locations
  const initializeMap = async (userLocation: Location) => {
    try {
      let destinationLocation: Location | null = null;

      // Use provided coordinates or geocode the address
      if (deliveryCoordinates) {
        destinationLocation = deliveryCoordinates;
      } else if (deliveryAddress) {
        destinationLocation = await geocodeAddress(deliveryAddress);
      }

      if (destinationLocation) {
        setDestination(destinationLocation);
        
        // Calculate region to fit both points
        const minLat = Math.min(userLocation.latitude, destinationLocation.latitude);
        const maxLat = Math.max(userLocation.latitude, destinationLocation.latitude);
        const minLng = Math.min(userLocation.longitude, destinationLocation.longitude);
        const maxLng = Math.max(userLocation.longitude, destinationLocation.longitude);

        const latDelta = (maxLat - minLat) * 1.5; // Add padding
        const lngDelta = (maxLng - minLng) * 1.5;

        setRegion({
          latitude: (minLat + maxLat) / 2,
          longitude: (minLng + maxLng) / 2,
          latitudeDelta: Math.max(latDelta, 0.01),
          longitudeDelta: Math.max(lngDelta, 0.01),
        });
      } else {
        // If we can't get destination, just show user location
        setRegion({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }

      setLoading(false);
    } catch (err) {
      logger.error('Error initializing map', err);
      setError('Failed to initialize map');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (providedCurrentLocation && error && errorType === 'permission') {
      setError(null);
      setErrorType(null);
    }
  }, [providedCurrentLocation, error, errorType]);

  if (loading && !providedCurrentLocation) {
    return (
      <View style={[styles.container, { height }]}>
        <ActivityIndicator size="large" color="#034703" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  // Render error message with helpful instructions
  const renderError = () => {
    // Don't show error UI if location is provided (permission already granted)
    if (providedCurrentLocation) return null;
    if (!error) return null;

    const getErrorInstructions = () => {
      switch (errorType) {
        case 'permission':
          if (Platform.OS === 'ios') {
            return (
              <>
                <Text style={styles.instructionText}>
                  To enable location access:
                </Text>
                <Text style={styles.stepText}>
                  1. Open Settings on your device{'\n'}
                  2. Scroll down and tap "Frontend"{'\n'}
                  3. Find "Location"{'\n'}
                  4. Select "While Using the App" or "Always"
                </Text>
              </>
            );
          } else {
            return (
              <>
                <Text style={styles.instructionText}>
                  To enable location access:
                </Text>
                <Text style={styles.stepText}>
                  1. Open Settings on your device{'\n'}
                  2. Go to Apps → Frontend{'\n'}
                  3. Tap Permissions{'\n'}
                  4. Enable Location permission
                </Text>
              </>
            );
          }
        case 'unavailable':
          return (
            <Text style={styles.instructionText}>
              Please check that location services are enabled on your device and try again.
            </Text>
          );
        case 'timeout':
          return (
            <Text style={styles.instructionText}>
              Location request took too long. Please check your connection and try again.
            </Text>
          );
        default:
          return (
            <Text style={styles.instructionText}>
              Please try again or check your device settings.
            </Text>
          );
      }
    };

    return (
      <View style={[styles.container, styles.errorContainer, { height }]}>
        <View style={styles.errorContent}>
          <Text style={styles.errorTitle}>Location Access Required</Text>
          <Text style={styles.errorText}>{error}</Text>
          {getErrorInstructions()}
          <View style={styles.buttonContainer}>
            {errorType === 'permission' && (
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={openSettings}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonText}>Open Settings</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetry}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (error) {
    return renderError();
  }

  if (!region) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.errorText}>Unable to load map</Text>
        <Text style={styles.diagnosticText}>
          Map region not available. Please check location permissions.
        </Text>
      </View>
    );
  }

  // Check if MapView is available
  if (!MapView) {
    return (
      <View style={[styles.container, styles.errorContainer, { height }]}>
        <View style={styles.errorContent}>
          <Text style={styles.errorTitle}>Map Component Error</Text>
          <Text style={styles.errorText}>
            MapView component is not available. Please ensure react-native-maps is properly installed.
          </Text>
          <Text style={styles.diagnosticText}>
            Run: cd ios && pod install && cd ..
          </Text>
        </View>
      </View>
    );
  }

  const fitMapToRoute = (coordinates: Array<{ latitude: number; longitude: number }>) => {
    if (mapRef.current && coordinates.length > 0) {
      const allCoords = [...coordinates];
      if (currentLocation) allCoords.push(currentLocation);
      if (destination) allCoords.push(destination);
      // Larger padding so pin labels (Adyar, You) are fully visible and not clipped at map edges
      mapRef.current.fitToCoordinates(allCoords, {
        edgePadding: { top: 100, right: 80, bottom: 100, left: 80 },
        animated: true,
      });
    }
  };

  // Haversine distance in km - used to pick shortest route mode for short distances
  const haversineKm = (a: Location, b: Location) => {
    const R = 6371;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        mapType="standard"
        initialRegion={region}
        mapPadding={{ top: 60, right: 40, bottom: 60, left: 40 }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        loadingEnabled={true}
        loadingIndicatorColor="#034703"
        onMapReady={() => {
          logger.info('Map is ready');
          if (currentLocation && destination) {
            fitMapToRoute([currentLocation, destination]);
          }
        }}
      >
        {currentLocation && (
          <Marker coordinate={currentLocation} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
            <View style={styles.customMarkerWrapper}>
              <View style={styles.markerLabel}>
                <Text
                  style={styles.markerLabelText}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {originLabel || 'You'}
                </Text>
              </View>
              <View style={styles.markerArrow} />
              <View style={[styles.markerDot, styles.originDot]} />
            </View>
          </Marker>
        )}
        {destination && (
          <Marker coordinate={destination} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
            <View style={styles.customMarkerWrapper}>
              <View style={[styles.markerLabel, styles.destinationLabel]}>
                <Text
                  style={[styles.markerLabelText, styles.destinationLabelText]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {destinationLabel || 'Store'}
                </Text>
              </View>
              <View style={[styles.markerArrow, styles.destinationArrow]} />
              <View style={[styles.markerDot, styles.destinationDot]} />
            </View>
          </Marker>
        )}
        {driverCoordinates && (
          <Marker coordinate={driverCoordinates} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
            <View style={styles.customMarkerWrapper}>
              <View style={[styles.markerLabel, styles.driverLabel]}>
                <Text
                  style={[styles.markerLabelText, styles.driverLabelText]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  Driver
                </Text>
              </View>
              <View style={[styles.markerArrow, styles.driverArrow]} />
              <View style={[styles.markerDot, styles.driverDot]} />
            </View>
          </Marker>
        )}
        {currentLocation && destination && (
          <MapViewDirections
            origin={currentLocation}
            destination={destination}
            apikey={GOOGLE_MAPS_API_KEY}
            strokeWidth={5}
            strokeColor="#034703"
            mode={haversineKm(currentLocation, destination) < 2 ? 'WALKING' : 'DRIVING'}
            region="in"
            optimizeWaypoints={true}
            onReady={(result) => {
              if (result.coordinates && result.coordinates.length > 0) {
                fitMapToRoute(result.coordinates);
              }

              const info: RouteInfo = {
                distanceKm: result.distance,
                durationMinutes: Math.round(result.duration),
              };
              setRouteInfo(info);
              onRouteInfo?.(info);
            }}
            onError={(errorMessage) => {
              // Log as warn - Directions API can fail if billing is not enabled on the Google Cloud project.
              // Map still shows markers; only the route polyline and ETA are unavailable.
              logger.warn('Directions API unavailable (route line/ETA hidden). Map markers still visible.', errorMessage);
            }}
          />
        )}
      </MapView>
      {showRouteInfo && routeInfo && (
        <View style={styles.routeInfoBadge}>
          {routeInfoDisplay === 'distanceOnly' ? (
            <Text style={styles.routeInfoDistValue}>
              {routeInfo.distanceKm.toFixed(1)} km distance
            </Text>
          ) : (
            <View style={styles.routeInfoRow}>
              <View style={styles.routeInfoEtaContainer}>
                <Text style={styles.routeInfoEtaValue}>{routeInfo.durationMinutes} min</Text>
                <Text style={styles.routeInfoEtaLabel}>ETA</Text>
              </View>
              <View style={styles.routeInfoDivider} />
              <View style={styles.routeInfoDistContainer}>
                <Text style={styles.routeInfoDistValue}>{routeInfo.distanceKm.toFixed(1)} km</Text>
                <Text style={styles.routeInfoDistLabel}>distance</Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    overflow: 'hidden',
  },
  errorContainer: {
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  errorContent: {
    width: '100%',
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  diagnosticText: {
    fontSize: 12,
    color: '#828282',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  instructionText: {
    fontSize: 13,
    color: '#4C4C4C',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 18,
  },
  stepText: {
    fontSize: 12,
    color: '#828282',
    textAlign: 'left',
    marginBottom: 16,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  settingsButton: {
    backgroundColor: '#034703',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    minWidth: 120,
  },
  retryButton: {
    backgroundColor: '#175FBE',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    minWidth: 120,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#828282',
  },
  customMarkerWrapper: {
    alignItems: 'center',
  },
  markerLabel: {
    backgroundColor: '#034703',
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: 12,
    minWidth: 44,
    maxWidth: 240,
    alignSelf: 'center',
  },
  markerLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  markerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#034703',
  },
  markerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginTop: -1,
  },
  originDot: {
    backgroundColor: '#034703',
  },
  destinationLabel: {
    backgroundColor: '#FA7500',
  },
  destinationLabelText: {
    color: '#FFFFFF',
  },
  destinationArrow: {
    borderTopColor: '#FA7500',
  },
  destinationDot: {
    backgroundColor: '#FA7500',
  },
  driverLabel: {
    backgroundColor: '#175FBE',
  },
  driverLabelText: {
    color: '#FFFFFF',
  },
  driverArrow: {
    borderTopColor: '#175FBE',
  },
  driverDot: {
    backgroundColor: '#175FBE',
  },
  routeInfoBadge: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  routeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  routeInfoEtaContainer: {
    alignItems: 'center',
  },
  routeInfoEtaValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#175FBE',
  },
  routeInfoEtaLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#828282',
    marginTop: 1,
  },
  routeInfoDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E0E0E0',
  },
  routeInfoDistContainer: {
    alignItems: 'center',
  },
  routeInfoDistValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#034703',
  },
  routeInfoDistLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#828282',
    marginTop: 1,
  },
});

export default RouteMap;

