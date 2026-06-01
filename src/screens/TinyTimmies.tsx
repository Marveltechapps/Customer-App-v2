import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, StatusBar, Platform, ScrollView, TouchableOpacity, Image, ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import type { RootStackNavigationProp } from '../types/navigation';
import BackIcon from '../components/icons/BackIcon';
import SearchIcon from '../components/icons/SearchIcon';
import Text from '../components/common/Text';
import BannerProductCard, { BannerProduct } from '../components/features/product/BannerProductCard';
import TinyTummiesCategoryCard, { TinyTummiesCategory } from '../components/TinyTummiesCategoryCard';
import ProductVariantModal, { ProductVariant } from '../components/features/product/ProductVariantModal';
import FloatingCartBar from '../components/features/cart/FloatingCartBar';
import DealsSection from '../components/sections/DealsSection';
import { logger } from '@/utils/logger';
import { useCart } from '@/contexts/CartContext';
import {
  variantRowsFromApiProduct,
  buildModalVariantsFromRows,
  fetchModalVariantsForProduct,
} from '../utils/productVariants';
import { isVariantRowInCart } from '@/utils/productCardCart';
import { useDimensions, scale, scaleFont, getSpacing, getBorderRadius, wp } from '../utils/responsive';

interface TinyTimmiesData {
  id: string;
  title: string;
  bannerImage: ImageSourcePropType;
  categories: TinyTummiesCategory[];
  bedtimeBoosters: BannerProduct[];
  deals: BannerProduct[];
}

const EMPTY_TINY_TIMMIES: TinyTimmiesData = {
  id: '',
  title: 'Tiny Tummies',
  bannerImage: require('../assets/images/tiny-timmies/banner-image-new.png'),
  categories: [],
  bedtimeBoosters: [],
  deals: [],
};

interface TinyTimmiesScreenProps {
  fetchTinyTimmiesData?: () => Promise<TinyTimmiesData>;
  onProductPress?: (productId: string) => void;
  onQuantityPress?: (productId: string) => void;
  onAddPress?: (productId: string) => void;
  onSearchPress?: () => void;
  onCategoryPress?: (categoryId: string) => void;
}

export default function TinyTimmiesScreen({
  fetchTinyTimmiesData,
  onProductPress,
  onQuantityPress,
  onAddPress,
  onSearchPress,
  onCategoryPress,
}: TinyTimmiesScreenProps = {} as TinyTimmiesScreenProps) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { updateQuantity, removeFromCart, getLineQuantity, cartItems } = useCart();
  const [tinyTimmiesData, setTinyTimmiesData] = useState<TinyTimmiesData>(EMPTY_TINY_TIMMIES);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productSelectedVariants, setProductSelectedVariants] = useState<Record<string, string>>({});

  // Placeholder for API integration
  useEffect(() => {
    if (fetchTinyTimmiesData) {
      const loadData = async () => {
        setLoading(true);
        try {
          const data = await fetchTinyTimmiesData();
          setTinyTimmiesData(data);
        } catch (error) {
          logger.error('Error fetching tiny-timmies data', error);
          setTinyTimmiesData(EMPTY_TINY_TIMMIES);
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }
  }, [fetchTinyTimmiesData]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleSearchPress = useCallback(() => {
    if (onSearchPress) {
      onSearchPress();
    } else {
      navigation.navigate('Search');
    }
  }, [navigation, onSearchPress]);

  const handleProductPress = useCallback((productId: string) => {
    if (onProductPress) {
      onProductPress(productId);
    } else {
      navigation.navigate('ProductDetail', { productId });
    }
  }, [navigation, onProductPress]);

  const handleCardPress = useCallback((productId: string) => {
    // Open ProductVariantModal when dropdown is clicked
    setSelectedProductId(productId);
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
  }, []);

  const handleVariantSelect = useCallback((variantId: string) => {
    setProductSelectedVariants(prev => {
      if (selectedProductId) {
        return {
          ...prev,
          [selectedProductId]: variantId,
        };
      }
      return prev;
    });
  }, [selectedProductId]);

  const handleAddToCart = useCallback((variantId: string) => {
    setProductSelectedVariants(prev => {
      if (selectedProductId) {
        return {
          ...prev,
          [selectedProductId]: variantId,
        };
      }
      return prev;
    });
  }, [selectedProductId]);

  const allTinyProducts = useMemo(
    () => [...tinyTimmiesData.bedtimeBoosters, ...tinyTimmiesData.deals],
    [tinyTimmiesData.bedtimeBoosters, tinyTimmiesData.deals],
  );

  const handleQuantityChange = useCallback(
    (variantId: string, quantity: number) => {
      const product = allTinyProducts.find((p) =>
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
    },
    [allTinyProducts, removeFromCart, updateQuantity],
  );

  const handleCategoryPress = useCallback((categoryId: string) => {
    if (onCategoryPress) {
      onCategoryPress(categoryId);
    } else {
      logger.info('Category pressed', { categoryId });
      // Navigate to category products page
    }
  }, [onCategoryPress]);

  const handleCheckoutPress = useCallback(() => {
    navigation.navigate('Checkout');
  }, [navigation]);

  const selectedProduct = selectedProductId
    ? [...tinyTimmiesData.bedtimeBoosters, ...tinyTimmiesData.deals].find(
        p => p.id === selectedProductId
      )
    : null;

  const getProductVariants = (): ProductVariant[] => {
    if (!selectedProduct) return [];
    const rows = variantRowsFromApiProduct(selectedProduct);
    return buildModalVariantsFromRows(selectedProduct, rows, getLineQuantity, selectedProduct.id);
  };

  const fetchVariantsForModal = useCallback(async () => {
    if (!selectedProductId) return [];
    return fetchModalVariantsForProduct(selectedProductId, getLineQuantity);
  }, [selectedProductId, getLineQuantity]);

  // Sync selected variants from cart when modal opens
  useEffect(() => {
    if (modalVisible && selectedProductId) {
      const prod = [...tinyTimmiesData.bedtimeBoosters, ...tinyTimmiesData.deals].find((p) => p.id === selectedProductId);
      const productVariants = prod ? variantRowsFromApiProduct(prod) : [];
      const variantInCart = prod
        ? productVariants.find((v) => isVariantRowInCart(cartItems, v, prod.id))
        : undefined;

      if (variantInCart && !productSelectedVariants[selectedProductId]) {
        // Auto-select variant that's in cart
        setProductSelectedVariants(prev => ({
          ...prev,
          [selectedProductId]: variantInCart.id,
        }));
      }
    }
  }, [modalVisible, selectedProductId, cartItems]);

  // Sync selected variants for all products when cart changes
  useEffect(() => {
    allTinyProducts.forEach((product) => {
      const productVariants = variantRowsFromApiProduct(product);
      const variantInCart = productVariants.find((v) =>
        isVariantRowInCart(cartItems, v, product.id),
      );

      if (variantInCart && !productSelectedVariants[product.id]) {
        setProductSelectedVariants(prev => ({
          ...prev,
          [product.id]: variantInCart.id,
        }));
      }
    });
  }, [cartItems, allTinyProducts, productSelectedVariants]);

  const { width: screenWidth } = useDimensions();
  
  // Responsive dimensions - memoized for performance
  const responsiveDimensions = useMemo(() => {
    // Product card width - responsive
    const cardWidth = scale(126.5);
    
    // Category cards layout - responsive calculation
    const containerPadding = getSpacing(16) * 2; // 16px on each side
    const gapBetweenCards = getSpacing(16);
    const availableWidth = screenWidth - containerPadding - gapBetweenCards;
    
    // Calculate responsive widths maintaining Figma proportions
    // Figma: First card 166px, Column 165.65px (total 331.65px)
    // Base design width is 375px, so scale factor is screenWidth / 375
    const baseDesignWidth = 375;
    const scaleFactor = screenWidth / baseDesignWidth;
    const figmaTotalWidth = 166 + 165.65; // 331.65px
    const figmaBaseWidth = figmaTotalWidth * scaleFactor;
    const figmaScaleFactor = availableWidth / figmaBaseWidth;
    
    const firstCardWidth = Math.max(166 * scaleFactor * figmaScaleFactor, scale(140)); // Minimum 140px
    const secondColumnWidth = Math.max(165.65 * scaleFactor * figmaScaleFactor, scale(140)); // Minimum 140px
    
    // Heights from Figma - responsive dimensions
    const firstCardHeight = 364.5 * scaleFactor * figmaScaleFactor; // First card: 166x364.5px from Figma
    const stackedCardHeight = 173.5 * scaleFactor * figmaScaleFactor; // Stacked cards: 165.65x173.5px each from Figma
    
    return {
      cardWidth,
      firstCardWidth,
      secondColumnWidth,
      firstCardHeight,
      stackedCardHeight,
    };
  }, [screenWidth]);
  
  const { cardWidth, firstCardWidth, secondColumnWidth, firstCardHeight, stackedCardHeight } = responsiveDimensions;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <BackIcon />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text variant="h3" style={styles.title}>
              {tinyTimmiesData.title}
            </Text>
          </View>
          <TouchableOpacity style={styles.searchButton} onPress={handleSearchPress}>
            <View style={styles.searchButtonContainer}>
              <SearchIcon width={scale(20)} height={scale(20)} />
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Banner Image */}
          <View style={styles.bannerContainer}>
            <Image
              source={tinyTimmiesData.bannerImage}
              style={styles.bannerImage}
              resizeMode="cover"
            />
          </View>

          {/* Category Cards Section - Matching Figma layout exactly, responsive */}
          <View style={styles.categoriesContainer}>
            <View style={styles.categoriesRow}>
              {/* First Card - Baby Essentials (responsive width, taller height) */}
              {tinyTimmiesData.categories[0] && (
                <View style={{ width: firstCardWidth }}>
                  <TinyTummiesCategoryCard
                    category={tinyTimmiesData.categories[0]}
                    onPress={() => handleCategoryPress(tinyTimmiesData.categories[0]?.id || '')}
                    width={firstCardWidth}
                    height={firstCardHeight}
                  />
                </View>
              )}
              {/* Column with two stacked cards (responsive width, 18px gap) */}
              <View style={[styles.categoriesColumn, { width: secondColumnWidth }]}>
                {tinyTimmiesData.categories[1] && (
                  <TinyTummiesCategoryCard
                    category={tinyTimmiesData.categories[1]}
                    onPress={() => handleCategoryPress(tinyTimmiesData.categories[1]?.id || '')}
                    width={secondColumnWidth}
                    height={stackedCardHeight}
                  />
                )}
                {tinyTimmiesData.categories[2] && (
                  <TinyTummiesCategoryCard
                    category={tinyTimmiesData.categories[2]}
                    onPress={() => handleCategoryPress(tinyTimmiesData.categories[2]?.id || '')}
                    width={secondColumnWidth}
                    height={stackedCardHeight}
                  />
                )}
              </View>
            </View>
          </View>

          {/* Bedtime Boosters Section - Exact Figma Design */}
          <View style={styles.bedtimeBoostersSection}>
            {/* Background Image - Full height background */}
            <View style={styles.bedtimeBoostersBackground}>
              <Image
                source={require('../assets/images/tiny-timmies/bedtime-boosters-section.png')}
                style={styles.bedtimeBoostersImage}
                resizeMode="cover"
              />
            </View>
            {/* Product Row - Horizontal Scrollable, positioned at y: 138 from Figma */}
            <View style={styles.bedtimeBoostersProductRowContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.bedtimeBoostersProductRow}
              >
                {tinyTimmiesData.bedtimeBoosters.map((product) => (
                  <View key={product.id} style={[styles.productCardWrapper, { width: cardWidth }]}>
                    <BannerProductCard
                      product={product}
                      onCardPress={() => handleCardPress(product.id)}
                      width={cardWidth}
                      selectedVariantId={productSelectedVariants[product.id]}
                      textColor="white"
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Banner Section */}
          <View style={styles.bannerSectionContainer}>
            <Image
              source={require('../assets/images/tiny-timmies/banner-below-bedtime-boosters.png')}
              style={styles.bannerSectionImage}
              resizeMode="cover"
            />
          </View>

          {/* Deals Section */}
          <DealsSection />
        </ScrollView>

        {/* Floating Cart Bar */}
        <FloatingCartBar onPress={handleCheckoutPress} hasBottomNav={false} />

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: getSpacing(16),
    paddingVertical: getSpacing(14),
    backgroundColor: '#FFFFFF',
    gap: getSpacing(8),
  },
  backButton: {
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    color: '#0D0D0D',
    fontFamily: 'Inter',
    fontWeight: '600',
  },
  searchButton: {
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  searchButtonContainer: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(52),
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: scale(100),
  },
  bannerContainer: {
    width: '100%',
    height: scale(160),
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  categoriesContainer: {
    paddingHorizontal: getSpacing(16),
    paddingTop: getSpacing(20),
    paddingBottom: getSpacing(20),
    alignItems: 'center',
    width: '100%',
  },
  categoriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: getSpacing(16),
    width: '100%',
    justifyContent: 'center',
  },
  categoriesColumn: {
    flexDirection: 'column',
    gap: getSpacing(18),
  },
  bedtimeBoostersSection: {
    width: '100%',
    height: scale(415), // Responsive height from Figma
    marginTop: getSpacing(10),
    marginBottom: getSpacing(10),
    position: 'relative',
  },
  bedtimeBoostersBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  bedtimeBoostersImage: {
    width: '100%',
    height: '100%',
  },
  bedtimeBoostersProductRowContainer: {
    position: 'absolute',
    top: scale(138), // Responsive y position from Figma
    left: 0,
    right: 0,
    paddingHorizontal: getSpacing(16), // Responsive x position from Figma
  },
  bedtimeBoostersProductRow: {
    gap: getSpacing(16), // Responsive gap between product cards from Figma
    alignItems: 'center',
  },
  horizontalScrollContent: {
    paddingHorizontal: getSpacing(16),
    gap: getSpacing(16),
  },
  productCardWrapper: {
    marginRight: getSpacing(16),
  },
  bannerSectionContainer: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    width: '100%',
    marginTop: getSpacing(16),
    marginBottom: getSpacing(16),
  },
  bannerSectionImage: {
    width: '100%',
    height: scale(272), // Responsive height from Figma
    borderRadius: getBorderRadius(8),
    overflow: 'hidden',
  },
});
