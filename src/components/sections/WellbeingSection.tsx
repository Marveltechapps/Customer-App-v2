import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '../../types/navigation';
import Text from '../common/Text';
import WellbeingCard, { WellbeingProduct } from '../WellbeingCard';
import { logger } from '@/utils/logger';
import handleHomeLink from '../../utils/navigation/linkHandler';

interface WellbeingSectionProps {
  onProductPress?: (productId: string) => void;
  fetchProducts?: () => Promise<WellbeingProduct[]>;
  starsImage?: ImageSourcePropType;
}

export default function WellbeingSection({ 
  onProductPress, 
  fetchProducts,
  starsImage 
}: WellbeingSectionProps) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const [products, setProducts] = useState<WellbeingProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const stars = starsImage;

  // Placeholder for API integration
  useEffect(() => {
    if (fetchProducts) {
      const loadProducts = async () => {
        setLoading(true);
        try {
          const data = await fetchProducts();
          setProducts(data);
        } catch (error) {
          logger.error('Error fetching wellbeing products', error);
          setProducts([]);
        } finally {
          setLoading(false);
        }
      };
      loadProducts();
    }
  }, [fetchProducts]);

  const handleProductPress = (productId: string) => {
    const product = products.find((p) => p.id === productId) as any;
    if (onProductPress) {
      onProductPress(productId);
      return;
    }

    // If product has a link, use link handler
    if (product && product.link) {
      handleHomeLink(product.link, navigation);
      return;
    }

    // Special-case Tiny Tummies fallback
    if (product && product.name === 'Tiny Tummies') {
      navigation.navigate('TinyTimmies');
      return;
    }

    logger.info('Wellbeing product pressed', { productId });
  };

  // Group products into rows of 2
  const rows: WellbeingProduct[][] = [];
  for (let i = 0; i < products.length; i += 2) {
    rows.push(products.slice(i, i + 2));
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        {/* Stars Image - Positioned absolutely */}
        {stars ? (
          <View style={styles.starsContainer}>
            <Image source={stars} style={styles.starsImage} resizeMode="contain" />
          </View>
        ) : null}

        <View style={styles.subtitleContainer}>
          {/* Title */}
          <Text style={styles.title}>Designed for Well-being</Text>

          {/* Divider with Tag */}
          <View style={styles.dividerContainer}>
            <LinearGradient
              colors={['rgba(182, 49, 158, 1)', 'rgba(252, 223, 247, 1)']}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 0 }}
              style={styles.dividerLine}
            />
            <View style={styles.tagContainer}>
              <Text style={styles.tagText}>Just for you </Text>
            </View>
            <LinearGradient
              colors={['rgba(182, 49, 158, 1)', 'rgba(252, 223, 247, 1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.dividerLine}
            />
          </View>
        </View>
      </View>

      {/* Product Grid - 2 columns x 2 rows */}
      <View style={styles.productsContainer}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.productRow}>
            {row.map((product) => (
              <WellbeingCard
                key={product.id}
                product={product}
                onPress={handleProductPress}
              />
            ))}
            {/* Fill remaining slot if row has less than 2 items */}
            {row.length < 2 && (
              <View style={styles.spacer} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: '#F9D9F3',
  },
  headerContainer: {
    width: 295,
    height: 64,
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  subtitleContainer: {
    alignItems: 'center',
    gap: 8,
    width: 295,
    marginTop: 11,
  },
  starsContainer: {
    width: 270,
    height: 35,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 13,
  },
  starsImage: {
    width: 270,
    height: 35,
  },
  title: {
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24.2,
    color: '#000000',
    textAlign: 'center',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  dividerLine: {
    width: 77,
    height: 1,
    flex: 1,
    maxWidth: 77,
  },
  tagContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#B6319E',
    borderRadius: 50,
    paddingVertical: 0,
    paddingHorizontal: 10,
    width: 108,
    height: 21,
  },
  tagText: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14.52,
    color: '#FFFFFF',
    textAlign: 'center',
    includeFontPadding: false,
  },
  productsContainer: {
    gap: 0,
    width: '100%',
    alignItems: 'center',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
    width: '100%',
    marginBottom: 0,
    justifyContent: 'center',
  },
  spacer: {
    width: 155,
  },
});

