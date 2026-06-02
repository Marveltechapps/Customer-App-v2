import React, { useState, useEffect, useCallback } from 'react';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { View, StyleSheet, StatusBar, Platform, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RootStackNavigationProp, RootStackRouteProp } from '../types/navigation';
import BackIcon from '../components/icons/BackIcon';
import Text from '../components/common/Text';
import ProductCard, { Product } from '../components/features/product/ProductCard';
import ProductVariantModal, { ProductVariant } from '../components/features/product/ProductVariantModal';
import FloatingCartBar from '../components/features/cart/FloatingCartBar';
import { useCart } from '@/contexts/CartContext';
import { logger } from '@/utils/logger';

import { getProductImageSource, productImageCatalogFromApi } from '../utils/productImage';
import * as productService from '../services/products/productService';
import {
  variantRowsFromApiProduct,
  buildModalVariantsFromRows,
  fetchModalVariantsForProduct,
} from '../utils/productVariants';
import { formatProductDiscountLabel, resolveProductOriginalPrice } from '../utils/productPricing';

interface SearchResultsScreenProps {
  fetchProducts?: (query: string) => Promise<Product[]>;
  onQuantityPress?: (productId: string) => void;
  onAddPress?: (productId: string) => void;
}

export default function SearchResultsScreen({
  fetchProducts,
  onQuantityPress,
  onAddPress,
}: SearchResultsScreenProps) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<RootStackRouteProp<'SearchResults'>>();
  const params = route.params || {};
  const [searchText, setSearchText] = useState(params.query || '');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const { updateQuantity, removeFromCart, getLineQuantity } = useCart();
  const [focusRefreshNonce, setFocusRefreshNonce] = useState(0);

  useRefreshOnFocus(() => {
    if (searchText.trim().length > 0) {
      setFocusRefreshNonce((n) => n + 1);
    }
  }, [searchText]);

  // API integration
  useEffect(() => {
    const query = searchText.trim();
    if (query.length === 0) {
      setProducts([]);
      return;
    }
    const loadProducts = async () => {
      setLoading(true);
      try {
        if (fetchProducts) {
          const data = await fetchProducts(searchText);
          setProducts(data);
        } else if (query.length < 2) {
          setProducts([]);
        } else {
          const resp = await productService.searchProducts(query);
          const items = productService.productsFromListResponse(resp);
          const mapped: Product[] = items.map((p) => {
            const id = String(p.id ?? (p as { _id?: string })._id ?? '');
            const rows = variantRowsFromApiProduct({ ...p, id });
            return {
              id,
              name: p.name ?? '',
              image: getProductImageSource(p),
              imageCatalog: productImageCatalogFromApi(p),
              price: p.price ?? 0,
              originalPrice: resolveProductOriginalPrice(p),
              discount: formatProductDiscountLabel(p),
              quantity: p.quantity || rows[0]?.size || '',
              variants: rows,
              gstRate:
                typeof p.gstRate === 'number'
                  ? p.gstRate
                  : typeof (p as { taxPercent?: number }).taxPercent === 'number'
                    ? (p as { taxPercent: number }).taxPercent
                    : undefined,
            };
          });
          setProducts(mapped);
        }
      } catch (error) {
        logger.error('Error fetching products', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    const debounceTimer = setTimeout(loadProducts, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchText, fetchProducts, focusRefreshNonce]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleClear = useCallback(() => {
    setSearchText('');
    setProducts([]);
  }, []);

  const handleQuantityPress = useCallback((productId: string) => {
    if (onQuantityPress) {
      onQuantityPress(productId);
    } else {
      logger.info('Quantity selector pressed for product', { productId });
    }
  }, [onQuantityPress]);

  const handleAddPress = useCallback((productId: string) => {
    if (onAddPress) {
      onAddPress(productId);
    } else {
      logger.info('Add to cart', { productId });
    }
  }, [onAddPress]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);
  }, []);

  // Get selected product for modal
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const getProductVariants = (): ProductVariant[] => {
    if (!selectedProduct) return [];
    const rows = variantRowsFromApiProduct(selectedProduct);
    return buildModalVariantsFromRows(selectedProduct, rows, getLineQuantity, selectedProduct.id);
  };

  const fetchVariantsForModal = useCallback(async () => {
    if (!selectedProductId) return [];
    return fetchModalVariantsForProduct(selectedProductId, getLineQuantity);
  }, [selectedProductId, getLineQuantity]);

  const handleVariantSelect = (variantId: string) => {
    // Handle variant selection if needed
  };

  /** Modal already calls `addToCart`; this callback is only for parent hooks. */
  const handleAddToCart = (_variantId: string) => {};

  const handleQuantityChange = (variantId: string, quantity: number) => {
    const product = products.find((p) =>
      variantRowsFromApiProduct(p).some((row) => row.id === variantId),
    );
    const row = product
      ? variantRowsFromApiProduct(product).find((r) => r.id === variantId)
      : undefined;
    const productId = row?.productId ?? product?.id;
    if (!productId) return;
    if (quantity <= 0) {
      removeFromCart(productId, variantId);
    } else {
      updateQuantity(productId, variantId, quantity);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            {/* Top Container - Search and Results Text */}
            <View style={styles.headerTop}>
              {/* Search Container */}
              <View style={styles.searchContainer}>
                {/* Back Button */}
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={handleBack}
                  activeOpacity={0.7}
                >
                  <BackIcon />
                </TouchableOpacity>

                {/* Text Input */}
                <View style={styles.textInputContainer}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search products..."
                    placeholderTextColor="#828282"
                    value={searchText}
                    onChangeText={handleSearchChange}
                    returnKeyType="search"
                    textAlignVertical="center"
                    numberOfLines={1}
                  />
                </View>

                {/* Clear Button */}
                {searchText.length > 0 && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={handleClear}
                    activeOpacity={0.7}
                  >
                    <View style={styles.clearButtonIcon}>
                      <Text style={styles.clearButtonText}>✕</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              {/* Results Header */}
              {searchText.trim().length > 0 && (
                <View style={styles.resultsHeader}>
                  <Text style={styles.resultsHeaderText}>
                    Showing results of "{searchText}"
                  </Text>
                </View>
              )}
            </View>

            {/* Product Cards */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            ) : products.length > 0 ? (
              <View style={styles.productsContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.productsScrollContent}
                  style={styles.productsScrollView}
                >
                  {products.map((product, index) => (
                    <View
                      key={product.id}
                      style={[
                        styles.cardWrapper,
                        index === 0 && styles.firstCard,
                        index === products.length - 1 && styles.lastCard,
                      ]}
                    >
                      <ProductCard
                        product={product}
                        onQuantityPress={handleQuantityPress}
                        onAddPress={handleAddPress}
                        onCardPress={(productId) => {
                          setSelectedProductId(productId);
                          setModalVisible(true);
                        }}
                      />
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : searchText.trim().length > 0 ? (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>No results found</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>

        {/* Product Variant Modal */}
        {selectedProduct && (
          <ProductVariantModal
            visible={modalVisible}
            productName={selectedProduct.name}
            productId={selectedProduct.id}
            variants={getProductVariants()}
            fetchVariants={fetchVariantsForModal}
            gstRate={typeof selectedProduct.gstRate === 'number' ? selectedProduct.gstRate : 0}
            onClose={handleCloseModal}
            onAfterClose={() => setSelectedProductId(null)}
            onVariantSelect={handleVariantSelect}
            onAddToCart={handleAddToCart}
            onQuantityChange={handleQuantityChange}
          />
        )}

        {/* Floating Cart Bar */}
        <FloatingCartBar onPress={() => navigation.navigate('Checkout')} hasBottomNav={false} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 24,
    alignItems: 'center',
  },
  headerTop: {
    width: '100%',
    alignSelf: 'stretch',
    gap: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center', // Center all items vertically
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 8.5,
    paddingHorizontal: 12,
    paddingVertical: 0, // Remove vertical padding to use alignItems: center
    minHeight: 48,
    height: 48,
  },
  backButton: {
    width: 32,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  textInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Center content vertically
    gap: 4,
    alignSelf: 'center',
    height: '100%', // Full height of parent container
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18, // Slightly larger than fontSize (14 * 1.28 ≈ 18)
    color: '#3B3B3B',
    paddingHorizontal: 0, // Horizontal padding handled by container
    paddingVertical: 0, // No vertical padding for perfect centering
    margin: 0,
    textAlign: 'left',
    textAlignVertical: 'center', // Vertically center text
    includeFontPadding: false, // Remove extra font padding
  },
  clearButton: {
    width: 32,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  clearButtonIcon: {
    width: 17.5,
    height: 17.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 18,
    color: '#828282',
    fontFamily: 'Inter',
    lineHeight: 17.5,
  },
  resultsHeader: {
    width: '100%',
    alignSelf: 'stretch',
    marginTop: 8,
  },
  resultsHeaderText: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    color: '#212121',
    textAlign: 'left',
  },
  productsContainer: {
    width: '100%',
    alignSelf: 'stretch',
  },
  productsScrollView: {
    flexGrow: 0,
  },
  productsScrollContent: {
    paddingRight: 16,
  },
  cardWrapper: {
    marginRight: 24,
  },
  firstCard: {
    marginLeft: 0,
  },
  lastCard: {
    marginRight: 0,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  loadingText: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400',
    color: '#212121',
  },
  noResultsContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  noResultsText: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400',
    color: '#212121',
  },
});

