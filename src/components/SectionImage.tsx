import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity, ImageSourcePropType } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '../types/navigation';
import { bannerIsTapEnabled } from '@/utils/bannerInteraction';
import { handleRedirect } from '../utils/navigation/linkHandler';

interface SectionImageProps {
  image?: ImageSourcePropType;
  onPress?: () => void;
  blockStyle?: { borderRadius?: number; height?: number };
}

export default function SectionImage({ image, onPress, blockStyle }: SectionImageProps) {
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

    // Fallback
    navigation.navigate('TinyTimmies');
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.imageContainer,
          blockStyle?.height != null && { height: blockStyle.height },
          blockStyle?.borderRadius != null && { borderRadius: blockStyle.borderRadius },
        ]}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <Image
          source={image}
          style={styles.image}
          resizeMode="cover"
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
  },
  imageContainer: {
    width: '100%',
    borderRadius: 0,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: undefined,
    resizeMode: 'cover',
  },
});

