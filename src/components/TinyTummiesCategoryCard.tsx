import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image, ImageSourcePropType } from 'react-native';

export interface TinyTummiesCategory {
  id: string;
  title: string;
  subtitle: string;
  backgroundColor: string;
  textColor: string;
  icon?: any; // SVG component or image source
  image?: ImageSourcePropType;
}

interface TinyTummiesCategoryCardProps {
  category: TinyTummiesCategory;
  onPress?: () => void;
  width?: number;
  height?: number;
}

export default function TinyTummiesCategoryCard({
  category,
  onPress,
  width = 166,
  height = 173.24,
}: TinyTummiesCategoryCardProps) {
  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          width,
          height,
          backgroundColor: category.backgroundColor,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {category.image && (
        <Image
          source={category.image}
          style={styles.image}
          resizeMode="cover"
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10.47835636138916, // Exact border radius from Figma
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

