import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity, ImageSourcePropType } from 'react-native';
import Text from './common/Text';
import { logger } from '@/utils/logger';
import { scaleFont } from '@/utils/responsive';

/** Figma reference card size — used only to convert absolute positions to proportional (%) layout. */
const BASE_CARD_WIDTH = 152;
const BASE_CARD_HEIGHT = 145;

export interface LifestyleItem {
  id: string;
  title: string;
  image: ImageSourcePropType;
  imagePosition: { x: number; y: number; width: number; height: number };
  titlePosition: { x: number; y: number; width: number };
  /** When set, tap uses handleHomeLink(link); otherwise no navigation. */
  link?: string;
  redirectType?: string;
  redirectValue?: string;
}

interface LifestyleCardProps {
  item: LifestyleItem;
  onPress?: (itemId: string) => void;
}

const pct = (value: number, base: number): `${number}%` => `${(value / base) * 100}%`;

export default function LifestyleCard({ item, onPress }: LifestyleCardProps) {
  const handlePress = () => {
    if (onPress) {
      onPress(item.id);
    } else {
      logger.info('Lifestyle item pressed', { itemId: item.id });
    }
  };

  return (
    <View style={styles.container}>
      {/* Title — proportional position derived from Figma pixel data */}
      <View
        style={[
          styles.titleContainer,
          {
            left: pct(item.titlePosition.x, BASE_CARD_WIDTH),
            top: pct(item.titlePosition.y, BASE_CARD_HEIGHT),
            width: pct(item.titlePosition.width, BASE_CARD_WIDTH),
          },
        ]}
      >
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
      </View>

      {/* Image — proportional position derived from Figma pixel data */}
      <View
        style={[
          styles.imageContainer,
          {
            left: pct(item.imagePosition.x, BASE_CARD_WIDTH),
            top: pct(item.imagePosition.y, BASE_CARD_HEIGHT),
            width: pct(item.imagePosition.width, BASE_CARD_WIDTH),
            height: pct(item.imagePosition.height, BASE_CARD_HEIGHT),
          },
        ]}
      >
        <Image source={item.image} style={styles.image} resizeMode="cover" />
      </View>

      {/* Explore Now Button - anchored to bottom */}
      <View style={styles.buttonWrapper}>
        <TouchableOpacity
          style={styles.buttonContainer}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Explore Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: BASE_CARD_WIDTH / BASE_CARD_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  titleContainer: {
    position: 'absolute',
    justifyContent: 'center',
    zIndex: 5,
  },
  title: {
    fontFamily: 'Inter',
    fontSize: scaleFont(14, 12, 17),
    fontWeight: '600',
    lineHeight: scaleFont(16.94, 15, 20),
    color: '#033D49',
    textAlign: 'left',
    backgroundColor: 'transparent',
  },
  imageContainer: {
    position: 'absolute',
    overflow: 'hidden',
    zIndex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  buttonWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '20%',
    zIndex: 10,
  },
  buttonContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#001D42',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 10,
  },
  buttonText: {
    fontFamily: 'Inter',
    fontSize: scaleFont(14, 12, 17),
    fontWeight: '600',
    lineHeight: scaleFont(16.94, 15, 20),
    color: '#FFFFFF',
  },
});
