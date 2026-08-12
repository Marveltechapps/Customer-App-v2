import React, { useMemo, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ImageSourcePropType, Animated, Easing } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Text from './common/Text';
import CmsRemoteImage, { type CmsImagePriority } from './common/CmsRemoteImage';
import { getImageFitFromUrl } from '@/utils/productImage';
import { shouldUseLocalPlaceholder } from '@/config/placeholder';
import { scaleFont } from '@/utils/responsive';

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
  width?: number;
  imagePriority?: CmsImagePriority;
  imageRecyclingKey?: string;
}

/** Design baseline card: 104×96 image band, 88px icon */
const BASE_CARD_WIDTH = 104;
const BASE_IMAGE_HEIGHT = 96;
const IMAGE_ASPECT = BASE_IMAGE_HEIGHT / BASE_CARD_WIDTH;

export default function CategoryCard({
  image,
  name,
  onPress,
  width,
  imagePriority = 'normal',
  imageRecyclingKey,
}: CategoryCardProps) {
  const cardWidth = width ?? BASE_CARD_WIDTH;
  const scaleFactor = cardWidth / BASE_CARD_WIDTH;
  const imageHeight = Math.round(cardWidth * IMAGE_ASPECT);
  const imagePadV = Math.max(2, Math.round(4 * scaleFactor));
  const imagePadH = Math.max(4, Math.round(8 * scaleFactor));
  const fontSize = scaleFont(12, 10, 14);
  const lineHeight = Math.round(fontSize * 1.5);
  const gap = Math.max(2, Math.round(4 * scaleFactor));

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

  const dynamicStyles = useMemo(
    () => ({
      container: { width: cardWidth, gap },
      imageContainer: {
        width: cardWidth,
        height: imageHeight,
        paddingVertical: imagePadV,
        paddingHorizontal: imagePadH,
        borderRadius: Math.max(6, Math.round(8 * Math.min(scaleFactor, 1.2))),
      },
      textContainer: { width: cardWidth },
      categoryName: { fontSize, lineHeight },
    }),
    [cardWidth, gap, imageHeight, imagePadV, imagePadH, scaleFactor, fontSize, lineHeight],
  );

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.container, dynamicStyles.container]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <View style={[styles.imageContainer, dynamicStyles.imageContainer]}>
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
        <View style={[styles.textContainer, dynamicStyles.textContainer]}>
          <Text style={[styles.categoryName, dynamicStyles.categoryName]} numberOfLines={2}>
            {name}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  imageContainer: {
    backgroundColor: '#EDEDED',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(209, 209, 209, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    paddingHorizontal: 2,
    paddingVertical: 0,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
    flexShrink: 0,
  },
  categoryName: {
    fontFamily: 'Inter',
    fontWeight: '500',
    color: '#1C1C1C',
    textAlign: 'center',
    textAlignVertical: 'top',
  },
});
