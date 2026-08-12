import React, { useCallback, useMemo, useState } from 'react';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RootStackNavigationProp, RootStackRouteProp } from '../types/navigation';
import BackIcon from '../components/icons/BackIcon';
import Text from '../components/common/Text';
import ProductCard, { Product } from '../components/features/product/ProductCard';
import FloatingCartBar from '../components/features/cart/FloatingCartBar';
import { api } from '../services/api/client';
import { endpoints } from '../services/api/endpoints';
import { getApiErrorMessage } from '../services/api/types';
import { getProductImageSource } from '../utils/productImage';
import { formatProductDiscountLabel, resolveProductOriginalPrice } from '../utils/productPricing';
import { variantRowsFromApiProduct } from '../utils/productVariants';
import { getGridMetrics, scaleFont, useResponsive } from '../utils/responsive';

function mapProduct(p: any): Product {
  const id = String(p._id ?? p.id ?? '');
  const rows = variantRowsFromApiProduct({ ...p, id });
  return {
    id,
    name: p.name ?? '',
    image: getProductImageSource(p),
    price: typeof p.price === 'number' ? p.price : Number(p.price ?? 0),
    originalPrice: resolveProductOriginalPrice(p),
    discount: formatProductDiscountLabel(p),
    quantity: p.quantity ?? rows[0]?.size ?? '',
    variants: rows,
    gstRate:
      typeof p.gstRate === 'number'
        ? p.gstRate
        : typeof p.taxPercent === 'number'
          ? p.taxPercent
          : undefined,
  };
}

export default function CollectionProducts() {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<RootStackRouteProp<'CollectionProducts'>>();
  const { collectionId } = route.params;
  const { width: screenWidth } = useResponsive();
  const [collection, setCollection] = useState<{ name: string; products: Product[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const grid = useMemo(
    () =>
      getGridMetrics(screenWidth, {
        gap: 12,
        horizontalPadding: 12,
        minColumns: 2,
        maxColumns: 4,
        preferredCardWidth: 140,
      }),
    [screenWidth],
  );

  const loadCollection = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get(endpoints.collection(collectionId));
      if (resp?.success && resp?.data) {
        const products = (resp.data.products || []).map(mapProduct);
        setCollection({ name: resp.data.name || 'Collection', products });
      } else {
        setCollection(null);
        setError('Collection not found');
      }
    } catch (err) {
      setCollection(null);
      setError(getApiErrorMessage(err, 'Failed to load collection'));
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useRefreshOnFocus(() => {
    void loadCollection();
  }, [loadCollection]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#034703" />
      </View>
    );
  }

  if (error || !collection) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Collection not found'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const titleSize = scaleFont(18, 16, 22);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <BackIcon />
        </TouchableOpacity>
        <Text style={[styles.title, { fontSize: titleSize }]} numberOfLines={1}>
          {collection.name}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.grid,
          { paddingHorizontal: grid.horizontalPadding, gap: grid.gap },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {collection.products.map((p) => (
          <View key={p.id} style={{ width: grid.cardWidth }}>
            <ProductCard product={p} width={grid.cardWidth} />
          </View>
        ))}
      </ScrollView>
      <FloatingCartBar onPress={() => navigation.navigate('Checkout')} hasBottomNav={false} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
    color: '#1A1A1A',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 12,
    paddingBottom: 80,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  errorText: { color: '#666', fontSize: 14, marginBottom: 16 },
  backBtn: { padding: 12, backgroundColor: '#034703', borderRadius: 8 },
  backBtnText: { color: '#FFF', fontSize: 14 },
});
