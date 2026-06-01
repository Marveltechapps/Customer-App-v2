import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity, ImageSourcePropType } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '../types/navigation';
import { bannerIsTapEnabled } from '@/utils/bannerInteraction';
import { handleRedirect } from '../utils/navigation/linkHandler';

interface GreensBannerProps {
  image?: ImageSourcePropType;
  onPress?: () => void;
  blockStyle?: { borderRadius?: number; height?: number };
}

export default function GreensBanner({ image, onPress, blockStyle }: GreensBannerProps) {
  const navigation = useNavigation<RootStackNavigationProp>();

  if (!image) {
    return null;
  }

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    const imgAny = image as any;
    if (imgAny && typeof imgAny === 'object') {
      if (!bannerIsTapEnabled(imgAny)) {
        return;
      }
      if (imgAny.redirectType && imgAny.redirectValue) {
        handleRedirect({ redirectType: imgAny.redirectType, redirectValue: imgAny.redirectValue }, navigation);
        return;
      }
      if (imgAny.link) {
        handleRedirect(imgAny.link, navigation);
        return;
      }
    }
    // No link - no-op
  };

  return (
    <View style={styles.container}>
      <View style={styles.bannerWrapper}>
        <TouchableOpacity
          style={[
            styles.bannerContainer,
            blockStyle?.height != null && { height: blockStyle.height },
            blockStyle?.borderRadius != null && { borderRadius: blockStyle.borderRadius },
          ]}
          onPress={handlePress}
          activeOpacity={0.9}
        >
          <Image
            source={image}
            style={styles.bannerImage}
            resizeMode="stretch"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 32,
    gap: 0,
  },
  bannerWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  bannerContainer: {
    width: 349,
    height: 96,
    borderRadius: 10,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
});
