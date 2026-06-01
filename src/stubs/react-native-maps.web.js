/**
 * Web fallback for react-native-maps.
 * Renders a Google Static Map image when we have center coordinates and API key,
 * otherwise a styled placeholder with a link to open in Google Maps.
 */
import React from 'react';
import { View, StyleSheet, Linking, Text, Platform, Image } from 'react-native';

let GOOGLE_MAPS_API_KEY = '';
try {
  const Constants = require('expo-constants').default;
  GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || Constants?.expoConfig?.extra?.googleMapsApiKey || '';
} catch {
  GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
}

const WEB_STYLES = StyleSheet.create({
  container: { width: '100%', height: '100%', backgroundColor: '#E8E8E8', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  mapImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholder: { padding: 16, alignItems: 'center', maxWidth: 280 },
  placeholderText: { fontSize: 14, color: '#525252', textAlign: 'center', marginBottom: 12 },
  link: { fontSize: 14, color: '#034703', fontWeight: '600', textDecorationLine: 'underline' },
});

function WebMapView(props) {
  const { style, initialRegion, region } = props;
  const reg = region || initialRegion;
  const lat = reg?.latitude ?? 12.9716;
  const lng = reg?.longitude ?? 77.5946;

  const staticMapUrl = GOOGLE_MAPS_API_KEY
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=14&size=600x300&scale=2&maptype=roadmap&key=${GOOGLE_MAPS_API_KEY}`
    : null;

  const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;

  if (Platform.OS !== 'web') {
    return React.createElement(View, { ...props, style: [WEB_STYLES.container, style] });
  }

  const content = staticMapUrl
    ? React.createElement(Image, { source: { uri: staticMapUrl }, style: WEB_STYLES.mapImg })
    : React.createElement(
        View,
        { style: WEB_STYLES.placeholder },
        React.createElement(Text, { style: WEB_STYLES.placeholderText }, 'Map preview unavailable. Open in Google Maps to view the route.'),
        React.createElement(Text, { style: WEB_STYLES.link, onPress: () => Linking.openURL(mapsLink) }, 'Open in Google Maps')
      );

  return React.createElement(
    View,
    { style: [WEB_STYLES.container, style], onStartShouldSetResponder: () => true, onResponderRelease: () => Linking.openURL(mapsLink) },
    content
  );
}

WebMapView.Marker = (props) => React.createElement(View, props);

export const Marker = WebMapView.Marker;
export const PROVIDER_GOOGLE = 'google';
export default WebMapView;
