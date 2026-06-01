import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Animated,
  Easing,
  ActivityIndicator,
  Platform,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useLocation, LocationData } from '../contexts/LocationContext';
import { useDimensions, scale, scaleFont, getSpacing, getBorderRadius, wp, hp } from '../utils/responsive';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { addressService } from '../services/address/addressService';
import { logger } from '@/utils/logger';
import { navigationFlags } from '../utils/navigationFlags';

type LocationPermissionRouteProp = RouteProp<RootStackParamList, 'LocationPermission'>;

const TAG_OPTIONS = ['Home', 'Office', 'Other'] as const;
type TagOption = typeof TAG_OPTIONS[number];

const LocationPermission: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<LocationPermissionRouteProp>();
  const fromAuth = route.params?.fromAuth ?? false;
  const { width } = useDimensions();
  const { requestLocationPermission, getCurrentLocation, loading } = useLocation();

  const [permissionDenied, setPermissionDenied] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapLocation, setMapLocation] = useState<LocationData | null>(null);
  const [showTagSelection, setShowTagSelection] = useState(false);
  const [selectedTag, setSelectedTag] = useState<TagOption>('Home');
  const [customTag, setCustomTag] = useState('');
  const [saving, setSaving] = useState(false);

  const mapFadeOpacity = useRef(new Animated.Value(0)).current;
  const tagSlideAnim = useRef(new Animated.Value(0)).current;

  const responsiveStyles = useMemo(() => ({
    iconSize: scale(80),
    pinSize: scale(36),
    heading: {
      fontSize: scaleFont(22, 20, 26),
      lineHeight: scaleFont(30, 28, 36),
    },
    subtitle: {
      fontSize: scaleFont(14, 12, 16),
      lineHeight: scaleFont(22, 18, 24),
    },
    buttonPadding: getSpacing(14),
    buttonRadius: getBorderRadius(12),
    buttonText: {
      fontSize: scaleFont(16, 14, 18),
      lineHeight: scaleFont(24, 22, 26),
    },
    deniedText: {
      fontSize: scaleFont(13, 11, 15),
      lineHeight: scaleFont(20, 16, 22),
    },
    spacing: {
      iconBottom: getSpacing(28),
      headingBottom: getSpacing(12),
      subtitleBottom: getSpacing(40),
      buttonBottom: getSpacing(16),
      contentPadding: getSpacing(24),
    },
  }), [width]);

  // --- Permission prompt animations ---
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const iconTranslateY = useRef(new Animated.Value(-20)).current;
  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(15)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(15)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(15)).current;

  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animate = (value: Animated.Value, toValue: number, duration: number, delay: number) =>
      Animated.timing(value, {
        toValue,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

    Animated.parallel([
      animate(iconOpacity, 1, 500, 0),
      animate(iconTranslateY, 0, 500, 0),
      animate(headingOpacity, 1, 400, 150),
      animate(headingTranslateY, 0, 400, 150),
      animate(subtitleOpacity, 1, 400, 250),
      animate(subtitleTranslateY, 0, 400, 250),
      animate(buttonOpacity, 1, 400, 350),
      animate(buttonTranslateY, 0, 400, 350),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseScale, { toValue: 1.6, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseScale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.4, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    pulse.start();

    return () => pulse.stop();
  }, []);

  const navigateForward = useCallback(() => {
    navigationFlags.skipLocationDrawer = true;
    if (fromAuth) {
      navigation.replace('MainTabs');
    } else {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('MainTabs');
      }
    }
  }, [fromAuth, navigation]);

  const transitionToMap = useCallback((loc: LocationData) => {
    setMapLocation(loc);
    setShowMap(true);
    mapFadeOpacity.setValue(0);
    Animated.timing(mapFadeOpacity, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [mapFadeOpacity]);

  const handleEnableLocation = useCallback(async () => {
    setFetchError(false);
    setPermissionDenied(false);

    const granted = await requestLocationPermission();
    if (!granted) {
      setPermissionDenied(true);
      return;
    }

    const loc = await getCurrentLocation();
    if (!loc) {
      setFetchError(true);
      return;
    }

    transitionToMap(loc);
  }, [requestLocationPermission, getCurrentLocation, transitionToMap]);

  const handleRetry = useCallback(async () => {
    setFetchError(false);
    const loc = await getCurrentLocation();
    if (!loc) {
      setFetchError(true);
      return;
    }
    transitionToMap(loc);
  }, [getCurrentLocation, transitionToMap]);

  const handleConfirmLocation = useCallback(() => {
    setShowTagSelection(true);
    Animated.timing(tagSlideAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tagSlideAnim]);

  const handleSaveWithTag = useCallback(async () => {
    if (!mapLocation) return;

    const label = selectedTag === 'Other' ? (customTag.trim() || 'Other') : selectedTag;

    setSaving(true);
    try {
      await addressService.create({
        label,
        line1: mapLocation.address || `${mapLocation.latitude.toFixed(6)}, ${mapLocation.longitude.toFixed(6)}`,
        city: mapLocation.city || 'Unknown',
        isDefault: true,
        ...(mapLocation.latitude != null &&
          mapLocation.longitude != null && {
            latitude: mapLocation.latitude,
            longitude: mapLocation.longitude,
          }),
      });
      navigateForward();
    } catch (error) {
      logger.error('Failed to save address', error);
      Alert.alert(
        'Could not save address',
        'We\'ll continue without saving. You can add it later from your profile.',
        [{ text: 'OK', onPress: navigateForward }],
      );
    } finally {
      setSaving(false);
    }
  }, [mapLocation, selectedTag, customTag, navigateForward]);

  const handleBackToPrompt = useCallback(() => {
    setShowMap(false);
    setMapLocation(null);
    setShowTagSelection(false);
    setSelectedTag('Home');
    setCustomTag('');
    tagSlideAnim.setValue(0);
  }, [tagSlideAnim]);

  // --- Map confirmation state ---
  if (showMap && mapLocation) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
        <Animated.View style={[styles.mapWrapper, { opacity: mapFadeOpacity }]}>
          {/* Back button */}
          <TouchableOpacity
            style={styles.mapBackButton}
            onPress={handleBackToPrompt}
            activeOpacity={0.7}
          >
            <Text style={styles.mapBackArrow}>‹</Text>
          </TouchableOpacity>

          <MapView
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            style={styles.map}
            initialRegion={{
              latitude: mapLocation.latitude,
              longitude: mapLocation.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }}
            showsUserLocation
            showsMyLocationButton={false}
          >
            <Marker
              coordinate={{
                latitude: mapLocation.latitude,
                longitude: mapLocation.longitude,
              }}
              title="Your Location"
              description={mapLocation.area || mapLocation.address}
            >
              <View style={styles.customMarker}>
                <View style={styles.markerDot} />
                <View style={styles.markerTail} />
              </View>
            </Marker>
          </MapView>

          {/* Address card overlay at bottom */}
          <View style={styles.addressOverlay}>
            <View style={styles.addressCard}>
              <View style={styles.addressRow}>
                <View style={styles.addressPinIcon}>
                  <View style={styles.addressPinHead}>
                    <View style={styles.addressPinDot} />
                  </View>
                  <View style={styles.addressPinTail} />
                </View>
                <View style={styles.addressTextContainer}>
                  <Text style={styles.addressArea} numberOfLines={1}>
                    {mapLocation.area || mapLocation.city || 'Your location'}
                  </Text>
                  <Text style={styles.addressFull} numberOfLines={2}>
                    {mapLocation.address || `${mapLocation.latitude.toFixed(4)}, ${mapLocation.longitude.toFixed(4)}`}
                  </Text>
                </View>
              </View>

              {showTagSelection ? (
                <Animated.View
                  style={{
                    opacity: tagSlideAnim,
                    transform: [{
                      translateY: tagSlideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    }],
                  }}
                >
                  <Text style={styles.tagLabel}>Save this address as</Text>
                  <View style={styles.tagRow}>
                    {TAG_OPTIONS.map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        style={[
                          styles.tagChip,
                          selectedTag === tag && styles.tagChipActive,
                        ]}
                        onPress={() => setSelectedTag(tag)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.tagChipText,
                            selectedTag === tag && styles.tagChipTextActive,
                          ]}
                        >
                          {tag}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {selectedTag === 'Other' && (
                    <TextInput
                      style={styles.customTagInput}
                      placeholder="Enter custom label"
                      placeholderTextColor="#6B6B6B"
                      value={customTag}
                      onChangeText={setCustomTag}
                      autoFocus
                      maxLength={30}
                    />
                  )}

                  <TouchableOpacity
                    style={[
                      styles.confirmButton,
                      { paddingVertical: responsiveStyles.buttonPadding, borderRadius: responsiveStyles.buttonRadius },
                      saving && styles.confirmButtonDisabled,
                    ]}
                    onPress={handleSaveWithTag}
                    activeOpacity={0.8}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={[styles.confirmButtonText, responsiveStyles.buttonText]}>
                        Save & Continue
                      </Text>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    { paddingVertical: responsiveStyles.buttonPadding, borderRadius: responsiveStyles.buttonRadius },
                  ]}
                  onPress={handleConfirmLocation}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.confirmButtonText, responsiveStyles.buttonText]}>
                    Confirm Location
                  </Text>
                </TouchableOpacity>
              )}

            </View>
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // --- Permission prompt state ---
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />

      <View style={styles.content}>
        {/* Icon with pulse ring */}
        <Animated.View
          style={[
            styles.iconArea,
            { marginBottom: responsiveStyles.spacing.iconBottom, opacity: iconOpacity, transform: [{ translateY: iconTranslateY }] },
          ]}
        >
          <View style={[styles.iconCircle, { width: responsiveStyles.iconSize, height: responsiveStyles.iconSize, borderRadius: responsiveStyles.iconSize / 2 }]}>
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  width: responsiveStyles.iconSize,
                  height: responsiveStyles.iconSize,
                  borderRadius: responsiveStyles.iconSize / 2,
                  transform: [{ scale: pulseScale }],
                  opacity: pulseOpacity,
                },
              ]}
            />
            <View style={[styles.pin, { width: responsiveStyles.pinSize, height: responsiveStyles.pinSize }]}>
              <View style={[styles.pinHead, { width: responsiveStyles.pinSize * 0.75, height: responsiveStyles.pinSize * 0.75, borderRadius: (responsiveStyles.pinSize * 0.75) / 2 }]}>
                <View style={[styles.pinDot, { width: responsiveStyles.pinSize * 0.25, height: responsiveStyles.pinSize * 0.25, borderRadius: (responsiveStyles.pinSize * 0.25) / 2 }]} />
              </View>
              <View style={[styles.pinTail, { borderLeftWidth: responsiveStyles.pinSize * 0.2, borderRightWidth: responsiveStyles.pinSize * 0.2, borderTopWidth: responsiveStyles.pinSize * 0.35 }]} />
            </View>
          </View>
        </Animated.View>

        {/* Heading */}
        <Animated.View style={{ opacity: headingOpacity, transform: [{ translateY: headingTranslateY }], marginBottom: responsiveStyles.spacing.headingBottom }}>
          <Text style={[styles.heading, responsiveStyles.heading]}>
            What's your delivery location?
          </Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View style={{ opacity: subtitleOpacity, transform: [{ translateY: subtitleTranslateY }], marginBottom: responsiveStyles.spacing.subtitleBottom, paddingHorizontal: wp(8) }}>
          <Text style={[styles.subtitle, responsiveStyles.subtitle]}>
            We need your location to show nearby stores and products available in your area
          </Text>
        </Animated.View>

        {/* Permission denied message */}
        {permissionDenied && (
          <View style={[styles.deniedContainer, { marginBottom: getSpacing(16) }]}>
            <Text style={[styles.deniedText, responsiveStyles.deniedText]}>
              Location permission was denied. You can enable it later from your device settings to get a personalised experience.
            </Text>
          </View>
        )}

        {/* Fetch error message */}
        {fetchError && (
          <View style={[styles.errorContainer, { marginBottom: getSpacing(16) }]}>
            <Text style={[styles.errorText, responsiveStyles.deniedText]}>
              Unable to fetch your location. Please check your connection and try again.
            </Text>
          </View>
        )}
      </View>

      {/* Bottom action area */}
      <Animated.View
        style={[
          styles.actionArea,
          { paddingHorizontal: responsiveStyles.spacing.contentPadding, opacity: buttonOpacity, transform: [{ translateY: buttonTranslateY }] },
        ]}
      >
        {fetchError ? (
          <TouchableOpacity
            style={[styles.button, { paddingVertical: responsiveStyles.buttonPadding, borderRadius: responsiveStyles.buttonRadius }]}
            onPress={handleRetry}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.buttonText, responsiveStyles.buttonText]}>Retry</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, { paddingVertical: responsiveStyles.buttonPadding, borderRadius: responsiveStyles.buttonRadius }]}
            onPress={handleEnableLocation}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.buttonText, responsiveStyles.buttonText]}>Enable Location</Text>
            )}
          </TouchableOpacity>
        )}

      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    backgroundColor: 'rgba(3, 71, 3, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    backgroundColor: 'rgba(3, 71, 3, 0.15)',
  },
  pin: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  pinHead: {
    backgroundColor: '#034703',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinDot: {
    backgroundColor: '#FFFFFF',
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#034703',
    marginTop: -2,
  },
  heading: {
    fontFamily: 'Inter',
    fontWeight: '600',
    textAlign: 'center',
    color: '#1A1A1A',
  },
  subtitle: {
    fontFamily: 'Inter',
    fontWeight: '400',
    textAlign: 'center',
    color: '#6B6B6B',
  },
  deniedContainer: {
    backgroundColor: 'rgba(3, 71, 3, 0.06)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 8,
  },
  deniedText: {
    fontFamily: 'Inter',
    fontWeight: '400',
    textAlign: 'center',
    color: '#4C4C4C',
  },
  errorContainer: {
    backgroundColor: 'rgba(244, 67, 54, 0.06)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 8,
  },
  errorText: {
    fontFamily: 'Inter',
    fontWeight: '400',
    textAlign: 'center',
    color: '#034703',
  },
  actionArea: {
    paddingBottom: 24,
  },
  button: {
    backgroundColor: '#034703',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  // --- Map confirmation styles ---
  mapWrapper: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapBackButton: {
    position: 'absolute',
    top: 12,
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  mapBackArrow: {
    fontSize: 28,
    fontWeight: '300',
    color: '#1A1A1A',
    marginTop: -2,
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
  addressOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  addressPinIcon: {
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  addressPinHead: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#034703',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressPinDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FFFFFF',
  },
  addressPinTail: {
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
  addressTextContainer: {
    flex: 1,
  },
  addressArea: {
    fontFamily: 'Inter',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 22,
    color: '#1A1A1A',
    marginBottom: 2,
  },
  addressFull: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 18,
    color: '#6B6B6B',
  },
  confirmButton: {
    backgroundColor: '#034703',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  // --- Tag selection styles ---
  tagLabel: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    color: '#1A1A1A',
    marginBottom: 12,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  tagChip: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#D4D4D4',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  tagChipActive: {
    backgroundColor: 'rgba(3, 71, 3, 0.1)',
    borderColor: '#034703',
  },
  tagChipText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 13,
    color: '#6B6B6B',
  },
  tagChipTextActive: {
    color: '#034703',
  },
  // skip button removed per requirements
  customTagInput: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#D4D4D4',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontFamily: 'Inter',
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 16,
  },
});

export default LocationPermission;
