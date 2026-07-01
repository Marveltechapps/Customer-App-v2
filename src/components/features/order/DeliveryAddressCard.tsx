import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapPinIcon from '@/assets/images/map-pin.svg';
import ChevronRightIcon from '@/assets/images/chevron-right.svg';

interface DeliveryAddressCardProps {
  address?: string;
  addressTitle?: string;
  onPress?: () => void;
  onChangePress?: () => void;
}

const DeliveryAddressCard: React.FC<DeliveryAddressCardProps> = ({
  address,
  addressTitle,
  onPress,
  onChangePress,
}) => {
  if (!address) {
    return (
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <MapPinIcon width={20} height={20} />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.placeholderText}>Select delivery address</Text>
          </View>
          <View style={styles.chevronContainer}>
            <ChevronRightIcon width={14} height={14} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.content}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <MapPinIcon width={20} height={20} />
        </View>
        <View style={styles.textContainer}>
          {addressTitle && (
            <Text style={styles.addressTitle}>{addressTitle}</Text>
          )}
          <Text style={styles.addressText}>{address}</Text>
        </View>
        <View style={styles.chevronContainer}>
          <ChevronRightIcon width={14} height={14} />
        </View>
      </TouchableOpacity>
      {onChangePress && (
        <TouchableOpacity
          style={styles.changeButton}
          onPress={onChangePress}
          activeOpacity={0.7}
        >
          <Text style={styles.changeButtonText}>Change</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 0.6,
    borderColor: '#F4F4F4',
    gap: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#828282',
    lineHeight: 20,
  },
  addressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    lineHeight: 20,
  },
  addressText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 18,
  },
  chevronContainer: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 3,
  },
  changeButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(3, 71, 3, 0.3)',
    borderRadius: 4,
  },
  changeButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#034703',
    lineHeight: 18,
  },
});

export default DeliveryAddressCard;

