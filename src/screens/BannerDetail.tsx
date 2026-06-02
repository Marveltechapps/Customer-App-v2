import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, StatusBar, Platform, ScrollView, TouchableOpacity, Image, ImageSourcePropType, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import type { RootStackNavigationProp, RootStackRouteProp } from '../types/navigation';
import { useVideoPlayer, VideoView } from 'expo-video';
import BackIcon from '../components/icons/BackIcon';
import SearchIcon from '../components/icons/SearchIcon';
import Text from '../components/common/Text';
import BannerProductCard, { BannerProduct } from '../components/features/product/BannerProductCard';
import WhyMoringaSection from '../components/sections/WhyMoringaSection';
import ProductVariantModal, { ProductVariant } from '../components/features/product/ProductVariantModal';
import FloatingCartBar from '../components/features/cart/FloatingCartBar';
import { useCart } from '@/contexts/CartContext';
import { useDimensions, getSpacing } from '../utils/responsive';
import { logger } from '@/utils/logger';
import { bannerService, type BannerContentItem } from '../services/banner/bannerService';
import { getProductImageSource } from '../utils/productImage';
import {
  variantRowsFromApiProduct,
  buildModalVariantsFromRows,
  fetchModalVariantsForProduct,
} from '../utils/productVariants';
import { isVariantRowInCart } from '@/utils/productCardCart';
import { formatProductDiscountLabel, resolveProductOriginalPrice } from '../utils/productPricing';
import { Theme } from '../constants/Theme';
import { bannerIsTapEnabled } from '@/utils/bannerInteraction';

function mapApiProductToBannerProduct(p: {
  _id: string;
  name?: string;
  price?: number;
  mrp?: number;
  originalPrice?: number;
  discount?: string;
  imageUrl?: string;
  images?: string[];
  variants?: unknown;
  [k: string]: unknown;
}): BannerProduct {
  const id = String(p._id);
  const rows = variantRowsFromApiProduct({ ...p, id });
  return {
    id,
    name: p.name || 'Product',
    image: getProductImageSource(p),
    price: p.price ?? 0,
    originalPrice: resolveProductOriginalPrice(p),
    discount: formatProductDiscountLabel(p),
    quantity: rows[0]?.size ?? '1 unit',
    variants: rows,
    gstRate: typeof p.gstRate === 'number' ? p.gstRate : typeof p.taxPercent === 'number' ? (p.taxPercent as number) : undefined,
  };
}

function BannerVideoBlock({ videoUrl }: { videoUrl: string }) {
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
    p.muted = false;
  });
  return (
    <View style={styles.videoBlock}>
      <VideoView
        player={player}
        style={styles.videoView}
        contentFit="contain"
        nativeControls
        fullscreenOptions={{ enable: false }}
      />
    </View>
  );
}

interface BannerDetailData {
  id: string;
  title: string;
  products: BannerProduct[];
}

const EMPTY_BANNER_DETAIL: BannerDetailData = {
  id: '',
  title: '',
  products: [],
};

interface BannerDetailScreenProps {
  fetchBannerDetail?: (bannerId: string) => Promise<BannerDetailData>;
  onProductPress?: (productId: string) => void;
  onQuantityPress?: (productId: string) => void;
  onAddPress?: (productId: string) => void;
  onSearchPress?: () => void;
}

export default function BannerDetailScreen({
  fetchBannerDetail,
  onProductPress,
  onQuantityPress,
  onAddPress,
  onSearchPress,
}: BannerDetailScreenProps) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<RootStackRouteProp<'BannerDetail'>>();
  const params = route.params || {};
  const [bannerData, setBannerData] = useState<BannerDetailData>(EMPTY_BANNER_DETAIL);
  const [apiBanner, setApiBanner] = useState<{ title?: string; contentItems?: BannerContentItem[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productSelectedVariants, setProductSelectedVariants] = useState<Record<string, string>>({});
  const { updateQuantity, removeFromCart, cartItems, getLineQuantity } = useCart();

  useRefreshOnFocus(() => {
    const loadBannerDetail = async () => {
      if (params.bannerId) {
        setLoading(true);
        setApiBanner(null);
        try {
          const res = await bannerService.getById(params.bannerId);
          if (res?.success && res.data) {
            const data = res.data;
            const sorted = (data.contentItems || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            if (params.contentItemId) {
              const sub = sorted.find((c) => String((c as BannerContentItem & { _id?: string })._id) === String(params.contentItemId));
              if (sub && (sub.type === 'banner' || sub.type === 'image')) {
                setApiBanner({
                  title: sub.blockTitle || data.title,
                  contentItems: sub.nestedContentItems || [],
                });
                setBannerData((prev) => ({
                  ...prev,
                  title: sub.blockTitle || data.title || prev.title,
                }));
              } else {
                setApiBanner({
                  title: data.title,
                  contentItems: sorted,
                });
                setBannerData((prev) => ({
                  ...prev,
                  title: data.title || prev.title,
                }));
              }
            } else {
              setApiBanner({
                title: data.title,
                contentItems: sorted,
              });
              setBannerData((prev) => ({
                ...prev,
                title: data.title || prev.title,
              }));
            }
          }
        } catch (error) {
          logger.error('Error fetching banner detail', error);
          setApiBanner(null);
        } finally {
          setLoading(false);
        }
      } else if (params.title) {
        setBannerData({ ...EMPTY_BANNER_DETAIL, title: String(params.title) });
      }
    };
    void loadBannerDetail();
  }, [params.bannerId, params.contentItemId, params.title]);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleSearch = () => {
    if (onSearchPress) {
      onSearchPress();
    } else {
      navigation.navigate('Search');
    }
  };

  const handleProductPress = (productId: string) => {
    if (onProductPress) {
      onProductPress(productId);
    } else {
      navigation.navigate('ProductDetail', { productId });
    }
  };

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

  const handleVariantSelect = (variantId: string) => {
    if (selectedProductId) {
      // Update selected variant for this product (synchronization)
      setProductSelectedVariants(prev => ({
        ...prev,
        [selectedProductId]: variantId,
      }));
    }
  };

  /** `ProductVariantModal` performs `addToCart`; keep only variant sync if needed. */
  const handleAddToCart = (variantId: string) => {
    if (selectedProductId) {
      setProductSelectedVariants((prev) => ({
        ...prev,
        [selectedProductId]: variantId,
      }));
    }
  };

  const apiProducts: BannerProduct[] = useMemo(() => {
    if (!apiBanner?.contentItems) return [];
    return apiBanner.contentItems
      .filter((c) => c.type === 'products' && Array.isArray(c.products))
      .flatMap((c) => (c as BannerContentItem & { products: Array<{ _id: string; name?: string; price?: number; imageUrl?: string; images?: string[] }> }).products.map(mapApiProductToBannerProduct));
  }, [apiBanner?.contentItems]);

  const allProducts = apiBanner ? apiProducts : bannerData.products;
  const selectedProduct = allProducts.find((p) => p.id === selectedProductId);

  const handleQuantityChange = (variantId: string, quantity: number) => {
    const product = allProducts.find((p) =>
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

  // Sync selected variants for all products when cart changes
  useEffect(() => {
    allProducts.forEach(product => {
      const productVariants = variantRowsFromApiProduct(product);
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
  }, [cartItems, allProducts]);

  const getProductVariants = (): ProductVariant[] => {
    if (!selectedProduct) return [];
    const rows = variantRowsFromApiProduct(selectedProduct);
    return buildModalVariantsFromRows(selectedProduct, rows, getLineQuantity, selectedProduct.id);
  };

  const fetchVariantsForModal = useCallback(async () => {
    if (!selectedProductId) return [];
    return fetchModalVariantsForProduct(selectedProductId, getLineQuantity);
  }, [selectedProductId, getLineQuantity]);

  // Group products into rows of 2
  const productRows: BannerProduct[][] = [];
  for (let i = 0; i < allProducts.length; i += 2) {
    productRows.push(allProducts.slice(i, i + 2));
  }

  // Calculate responsive card width using responsive utilities
  const { width: screenWidth } = useDimensions();
  const containerPadding = getSpacing(16) * 2; // Left and right padding
  const columnGap = getSpacing(16); // Gap between cards (horizontal)
  const productCardWidth = (screenWidth - containerPadding - columnGap) / 2;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <BackIcon />
          </TouchableOpacity>

          {/* Title Container - Near Back Button */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{apiBanner?.title ?? bannerData.title}</Text>
          </View>

          {/* Search Button */}
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
            activeOpacity={0.7}
          >
            <View style={styles.searchButtonIcon}>
              <SearchIcon />
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1A1A1A" />
            </View>
          ) : apiBanner ? (
            <>
              {[...(apiBanner.contentItems || [])]
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((item, idx) => {
                  if (item.type === 'banner' || item.type === 'image') {
                    const url = item.imageUrl;
                    if (!url) return null;
                    const tap = bannerIsTapEnabled(item);
                    const link = typeof item.link === 'string' ? item.link.trim() : '';
                    const block = item as BannerContentItem;
                    const nested = block.nestedContentItems;
                    const hasNested = Array.isArray(nested) && nested.length > 0;
                    const hasSubDesign = hasNested || Boolean(block.blockTitle?.trim());
                    const subId = (item as BannerContentItem & { _id?: string })._id;
                    const keyId = subId ?? idx;
                    if (!tap) {
                      return (
                        <View key={`${item.type}-${String(keyId)}`} style={styles.bannerImageContainer}>
                          <Image source={{ uri: url }} style={styles.bannerImage} resizeMode="stretch" />
                        </View>
                      );
                    }
                    if (hasSubDesign && params.bannerId && subId) {
                      return (
                        <TouchableOpacity
                          key={`${item.type}-${String(keyId)}`}
                          style={styles.bannerImageContainer}
                          activeOpacity={0.9}
                          onPress={() => {
                            navigation.push('BannerDetail', {
                              bannerId: String(params.bannerId),
                              contentItemId: String(subId),
                              title: block.blockTitle || '',
                            });
                          }}
                        >
                          <Image source={{ uri: url }} style={styles.bannerImage} resizeMode="stretch" />
                        </TouchableOpacity>
                      );
                    }
                    if (link) {
                      return (
                        <TouchableOpacity
                          key={`${item.type}-${String(keyId)}`}
                          style={styles.bannerImageContainer}
                          activeOpacity={0.9}
                          onPress={() => {
                            Linking.openURL(link).catch(() => {});
                          }}
                        >
                          <Image source={{ uri: url }} style={styles.bannerImage} resizeMode="stretch" />
                        </TouchableOpacity>
                      );
                    }
                    return (
                      <View key={`${item.type}-${String(keyId)}`} style={styles.bannerImageContainer}>
                        <Image source={{ uri: url }} style={styles.bannerImage} resizeMode="stretch" />
                      </View>
                    );
                  }
                  if (item.type === 'video' && item.videoUrl) {
                    return <BannerVideoBlock key={`video-${idx}`} videoUrl={item.videoUrl} />;
                  }
                  if (item.type === 'text' && item.text) {
                    return (
                      <View key={`text-${idx}`} style={styles.textBlock}>
                        <Text style={styles.contentText}>{item.text}</Text>
                      </View>
                    );
                  }
                  if (item.type === 'products' && item.products?.length) {
                    const rows: BannerProduct[][] = [];
                    for (let i = 0; i < item.products.length; i += 2) {
                      rows.push(item.products.slice(i, i + 2).map(mapApiProductToBannerProduct));
                    }
                    return (
                      <View key={`products-${idx}`} style={styles.productListContainer}>
                        {rows.map((row, ri) => (
                          <View key={ri} style={styles.productRow}>
                            {row.map((product) => (
                              <View key={product.id} style={[styles.productCardWrapper, { width: productCardWidth }]}>
                                <BannerProductCard
                                  product={product}
                                  onQuantityPress={handleQuantityPress}
                                  onAddPress={handleAddPress}
                                  onCardPress={handleCardPress}
                                  width={productCardWidth}
                                  selectedVariantId={productSelectedVariants[product.id]}
                                />
                              </View>
                            ))}
                            {row.length === 1 && <View style={[styles.productCardWrapper, { width: productCardWidth }]} />}
                          </View>
                        ))}
                      </View>
                    );
                  }
                  return null;
                })}
            </>
          ) : (
            <>
              <View style={styles.productListContainer}>
                {productRows.map((row, index) => (
                  <React.Fragment key={`row-${index}`}>
                    <View style={styles.productRow}>
                      {row.map((product) => (
                        <View key={product.id} style={[styles.productCardWrapper, { width: productCardWidth }]}>
                          <BannerProductCard
                            product={product}
                            onQuantityPress={handleQuantityPress}
                            onAddPress={handleAddPress}
                            onCardPress={handleCardPress}
                            width={productCardWidth}
                            selectedVariantId={productSelectedVariants[product.id]}
                          />
                        </View>
                      ))}
                      {row.length === 1 && <View style={[styles.productCardWrapper, { width: productCardWidth }]} />}
                    </View>
                    {index === 1 && <WhyMoringaSection />}
                  </React.Fragment>
                ))}
              </View>
            </>
          )}
        </ScrollView>

        {/* Floating Cart Bar - 4px above bottom nav bar */}
        <FloatingCartBar onPress={() => navigation.navigate('Checkout')} hasBottomNav={false} />

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
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28, // 1.4 * 20
    color: '#1A1A1A',
    textAlign: 'left',
  },
  searchButton: {
    width: 28,
    height: 28,
    borderRadius: 52,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  searchButtonIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Theme.spacing.sectionCardGap,
  },
  bannerImageContainer: {
    width: '100%',
    height: 160,
    backgroundColor: '#EDEDED',
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  productListContainer: {
    paddingHorizontal: Theme.spacing.sectionCardGap,
    paddingTop: Theme.spacing.sectionCardGap,
    paddingBottom: Theme.spacing.sectionCardGap,
    gap: Theme.spacing.lg,
    alignItems: 'center',
  },
  productRow: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  productCardWrapper: {
    // Width will be set dynamically via inline style
  },
  loadingContainer: {
    flex: 1,
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoBlock: {
    width: '100%',
    height: 200,
    backgroundColor: '#000',
  },
  videoView: {
    width: '100%',
    height: '100%',
  },
  textBlock: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  contentText: {
    fontFamily: 'Inter',
    fontSize: 16,
    lineHeight: 24,
    color: '#1A1A1A',
  },
});

