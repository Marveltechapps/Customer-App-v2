import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Text from '../common/Text';
import ProductCard, { Product } from '../features/product/ProductCard';
import ProductVariantModal, { ProductVariant } from '../features/product/ProductVariantModal';
import { useCart } from '@/contexts/CartContext';
import { logger } from '@/utils/logger';
import {
  variantRowsFromApiProduct,
  buildModalVariantsFromRows,
  fetchModalVariantsForProduct,
} from '@/utils/productVariants';
import { isVariantRowInCart } from '@/utils/productCardCart';

interface NewDealsSectionProps {
  title?: string;
  onQuantityPress?: (productId: string) => void;
  onAddPress?: (productId: string) => void;
  fetchProducts?: () => Promise<Product[]>;
}

export default function NewDealsSection({
  title,
  onQuantityPress,
  onAddPress,
  fetchProducts,
}: NewDealsSectionProps) {
  const { updateQuantity, removeFromCart, cartItems, getLineQuantity } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productSelectedVariants, setProductSelectedVariants] = useState<Record<string, string>>({});

  // Placeholder for API integration
  useEffect(() => {
    if (fetchProducts) {
      const loadProducts = async () => {
        setLoading(true);
        try {
          const data = await fetchProducts();
          setProducts(data);
        } catch (error) {
          logger.error('Error fetching products', error);
          setProducts([]);
        } finally {
          setLoading(false);
        }
      };
      loadProducts();
    }
  }, [fetchProducts]);

  const handleQuantityPress = (productId: string) => {
    if (onQuantityPress) {
      onQuantityPress(productId);
    } else {
      logger.info('Quantity selector pressed for product', { productId });
    }
  };

  const handleAddPress = (productId: string) => {
    if (onAddPress) {
      onAddPress(productId);
    } else {
      logger.info('Add to cart', { productId });
    }
  };

  const handleCardPress = (productId: string) => {
    // Open ProductVariantModal when dropdown is clicked
    setSelectedProductId(productId);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
  };

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId],
  );

  const handleVariantSelect = (variantId: string) => {
    if (selectedProductId) {
      // Update selected variant for this product (synchronization)
      setProductSelectedVariants(prev => ({
        ...prev,
        [selectedProductId]: variantId,
      }));
    }
  };

  const handleAddToCart = (variantId: string) => {
    if (selectedProductId) {
      setProductSelectedVariants((prev) => ({
        ...prev,
        [selectedProductId]: variantId,
      }));
    }
  };

  const handleQuantityChange = (variantId: string, quantity: number) => {
    const product = products.find((p) =>
      rowsForProduct(p).some((row) => row.id === variantId),
    );
    const row = product
      ? rowsForProduct(product).find((r) => r.id === variantId)
      : undefined;
    const productId = row?.productId ?? product?.id;
    if (!productId) return;
    if (quantity <= 0) {
      removeFromCart(productId, variantId);
    } else {
      updateQuantity(productId, variantId, quantity);
    }
  };

  const rowsForProduct = useCallback((p: Product) => variantRowsFromApiProduct(p), []);

  useEffect(() => {
    products.forEach(product => {
      const productVariants = rowsForProduct(product);
      const variantInCart = productVariants.find((v) =>
        isVariantRowInCart(cartItems, v, product.id),
      );
      
      // If variant is in cart and not already selected, auto-select it
      // This ensures product card shows quantity selector when item is added from dropdown
      if (variantInCart) {
        setProductSelectedVariants(prev => {
          // Only update if not already set or if different variant is in cart
          if (!prev[product.id] || prev[product.id] !== variantInCart.id) {
            return {
              ...prev,
              [product.id]: variantInCart.id,
            };
          }
          return prev;
        });
      }
    });
  }, [cartItems, products, rowsForProduct]);

  const getProductVariants = (): ProductVariant[] => {
    if (!selectedProduct) return [];
    const rows = variantRowsFromApiProduct(selectedProduct);
    return buildModalVariantsFromRows(selectedProduct, rows, getLineQuantity, selectedProduct.id);
  };

  const fetchVariantsForModal = useCallback(async () => {
    if (!selectedProductId) return [];
    return fetchModalVariantsForProduct(selectedProductId, getLineQuantity);
  }, [selectedProductId, getLineQuantity]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.dividerContainer}>
          <LinearGradient
            colors={['rgba(121, 121, 121, 1)', 'rgba(245, 245, 245, 1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.divider}
          />
        </View>
      </View>

      {/* Product Cards - Horizontal Scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
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
              variants={rowsForProduct(product)}
              onQuantityPress={handleQuantityPress}
              onAddPress={handleAddPress}
              onCardPress={handleCardPress}
              selectedVariantId={productSelectedVariants[product.id]}
            />
          </View>
        ))}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
    backgroundColor: '0',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  titleContainer: {
    flexShrink: 0,
  },
  title: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 19.36,
    color: '#222222',
  },
  dividerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    width: '100%',
    height: 1,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingRight: 16,
  },
  cardWrapper: {
    marginRight: 16,
  },
  firstCard: {
    marginLeft: 0,
  },
  lastCard: {
    marginRight: 0,
  },
});

