import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity, ImageSourcePropType } from 'react-native';
import Text from './common/Text';
import { logger } from '@/utils/logger';

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
      {/* Title */}
      <View style={[styles.titleContainer, {
        left: item.titlePosition.x,
        top: item.titlePosition.y,
        width: item.titlePosition.width,
      }]}>
        <Text style={styles.title}>{item.title}</Text>
      </View>

      {/* Image - positioned according to Figma */}
      <View style={[styles.imageContainer, {
        left: item.imagePosition.x,
        top: item.imagePosition.y,
        width: item.imagePosition.width,
        height: item.imagePosition.height,
      }]}>
        <Image source={item.image} style={styles.image} resizeMode="cover" />
      </View>

      {/* Explore Now Button - positioned at bottom (y: 116) */}
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
    width: 152,
    height: 145,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  titleContainer: {
    position: 'absolute',
    height: 17,
    justifyContent: 'center',
    zIndex: 5,
  },
  title: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 16.94,
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
    bottom: 0,
    width: 152,
    height: 29,
    zIndex: 10,
  },
  buttonContainer: {
    width: '100%',
    height: 29,
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
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 16.94,
    color: '#FFFFFF',
  },
});

