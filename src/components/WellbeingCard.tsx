import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity, ImageSourcePropType } from 'react-native';
import Text from './common/Text';
import { logger } from '@/utils/logger';

export interface WellbeingProduct {
  id: string;
  name: string;
  description: string;
  image: ImageSourcePropType;
}

interface WellbeingCardProps {
  product: WellbeingProduct;
  onPress?: (productId: string) => void;
}

export default function WellbeingCard({ product, onPress }: WellbeingCardProps) {
  const handlePress = () => {
    if (onPress) {
      onPress(product.id);
    } else {
      logger.info('Wellbeing product pressed', { productId: product.id });
    }
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.9}>
      <View style={styles.imageContainer}>
        <Image source={product.image} style={styles.image} resizeMode="cover" />
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.productDescription}>{product.description}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 155,
    gap: 8,
  },
  imageContainer: {
    width: 155,
    height: 172,
    borderRadius: 0,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    alignItems: 'center',
    gap: 2,
    width: '100%',
  },
  productName: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 19.36,
    color: '#000000',
    textAlign: 'center',
  },
  productDescription: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 14.52,
    color: '#000000',
    textAlign: 'center',
  },
});

