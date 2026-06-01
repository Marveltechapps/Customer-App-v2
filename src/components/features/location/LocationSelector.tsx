import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Text from '../../common/Text';
import LocationArrowIcon from '../../icons/LocationArrowIcon';

interface LocationSelectorProps {
  deliveryType: string;
  address: string;
  onPress?: () => void;
}

export default function LocationSelector({ deliveryType, address, onPress }: LocationSelectorProps) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.content}>
        <View style={styles.deliveryInfo}>
          <View style={styles.deliveryTypeRow}>
            <Text style={styles.deliveryTypeText}>{deliveryType}</Text>
            <View style={styles.arrowContainer}>
              <LocationArrowIcon />
            </View>
          </View>
          <Text style={styles.addressText} numberOfLines={1}>
            {address}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveryInfo: {
    flex: 1,
  },
  deliveryTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6, // Match Figma gap of ~5.95px
  },
  deliveryTypeText: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    color: '#222222',
  },
  arrowContainer: {
    width: 22,
    height: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 0,
  },
  addressText: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    color: '#222222',
    marginTop: 0,
  },
});

