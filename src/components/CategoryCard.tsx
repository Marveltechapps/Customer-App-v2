import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ImageSourcePropType, Animated, Easing } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Text from './common/Text';
import CmsRemoteImage, { type CmsImagePriority } from './common/CmsRemoteImage';
import { getImageFitFromUrl } from '@/utils/productImage';
import { shouldUseLocalPlaceholder } from '@/config/placeholder';

function remoteDisplayUri(src: ImageSourcePropType): string | null {
  if (typeof src === 'object' && src !== null && !Array.isArray(src) && 'uri' in src) {
    const u = (src as { uri?: string }).uri;
    if (typeof u !== 'string') return null;
    const trimmed = u.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (shouldUseLocalPlaceholder(trimmed)) return trimmed;
  }
  return null;
}

interface CategoryCardProps {
  image: ImageSourcePropType;
  name: string;
  onPress?: () => void;
  width?: number; // Optional width prop for responsive design
  imagePriority?: CmsImagePriority;
  imageRecyclingKey?: string;
}

export default function CategoryCard({ image, name, onPress, width, imagePriority = 'normal', imageRecyclingKey }: CategoryCardProps) {
  // Card width is 104px, image container stretches to full width with padding inside
  const cardWidth = width || 104;

  // Press animation
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  const handlePress = () => {
    // Quick scale animation on press
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.92,
        duration: 100,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
    ]).start(() => {
      onPress?.();
    });
  };

  const httpUri = remoteDisplayUri(image);
  const remoteFit = getImageFitFromUrl(httpUri);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.container, width != null ? { width } : undefined]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <View style={[styles.imageContainer, { width: cardWidth }]}>
          {httpUri ? (
            <CmsRemoteImage
              uri={httpUri}
              style={styles.image}
              contentFit={remoteFit}
              transition={100}
              priority={imagePriority}
              recyclingKey={imageRecyclingKey ?? httpUri}
            />
          ) : (
            <ExpoImage
              source={image as any}
              style={styles.image}
              contentFit="contain"
              cachePolicy="disk"
              transition={100}
            />
          )}
        </View>
        <View style={[styles.textContainer, { width: cardWidth }]}>
          <Text style={styles.categoryName} numberOfLines={2}>
            {name}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 104,
    gap: 4, // Matches Figma gap between image and text
    alignItems: 'center',
  },
  imageContainer: {
    width: 104,
    height: 96,
    backgroundColor: '#EDEDED',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(209, 209, 209, 0.3)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  image: {
    width: 88,
    height: 88,
    maxWidth: '100%',
    maxHeight: '100%',
  },
  textContainer: {
    paddingHorizontal: 2, // Minimal padding, matches Figma (varies by item but 2px is common)
    paddingVertical: 0,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch', // Matches Figma layout
    width: 104,
    flexShrink: 0,
  },
  categoryName: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18, // 1.5em = 18px
    color: '#1C1C1C',
    textAlign: 'center',
    textAlignVertical: 'top', // Matches Figma textAlignVertical: TOP
  },
});

