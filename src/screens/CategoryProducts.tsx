import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  Platform,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useCatalogCache } from '../contexts/CatalogCacheContext';
import type { RootStackNavigationProp, RootStackRouteProp } from '../types/navigation';
import BackIcon from '../components/icons/BackIcon';
import SearchIcon from '../components/icons/SearchIcon';
import Text from '../components/common/Text';
import SubCategoryItem from '../components/SubCategoryItem';
import CategoryBanner from '../components/CategoryBanner';
import ProductCard, { Product } from '../components/features/product/ProductCard';
import FloatingCartBar from '../components/features/cart/FloatingCartBar';
import ProductVariantModal, { ProductVariant } from '../components/features/product/ProductVariantModal';
import { useCart } from '@/contexts/CartContext';
import { useDimensions, getSpacing, scale, getTwoColumnCardWidth } from '../utils/responsive';
import { logger } from '@/utils/logger';
import categoryService, { type CategoryPayloadProduct } from '../services/category/categoryService';
import { handleHomeLink, handleRedirect } from '../utils/navigation/linkHandler';
import { bannerIsTapEnabled } from '@/utils/bannerInteraction';
import { getApiErrorMessage } from '../services/api/types';
import { getProductImageSource, productImageCatalogFromApi } from '../utils/productImage';
import {
  variantRowsFromApiProduct,
  buildModalVariantsFromRows,
  fetchModalVariantsForProduct,
} from '../utils/productVariants';
import { isVariantRowInCart } from '@/utils/productCardCart';
import { formatProductDiscountLabel, resolveProductOriginalPrice } from '../utils/productPricing';

// Dummy static data - ready for API replacement
interface SubCategory {
  id: string;
  name: string;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  cardImageUrl?: string | null;
  slug?: string;
}

interface BannerItem {
  id: string;
  image: any;
  link?: string | null;
  redirectType?: string | null;
  redirectValue?: string | null;
}

interface CategoryProductsScreenProps {
  categoryId?: string;
  categoryName?: string;
  fetchSubCategories?: () => Promise<SubCategory[]>;
  fetchBanners?: () => Promise<BannerItem[]>;
  fetchProducts?: (subCategoryId: string) => Promise<Product[]>;
  onProductPress?: (productId: string) => void;
  onQuantityPress?: (productId: string) => void;
  onAddPress?: (productId: string) => void;
  onSearchPress?: () => void;
}

export default function CategoryProducts({
  categoryId,
  categoryName,
  fetchSubCategories,
  fetchBanners,
  fetchProducts,
  onProductPress,
  onQuantityPress,
  onAddPress,
  onSearchPress,
}: CategoryProductsScreenProps) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<RootStackRouteProp<'CategoryProducts'>>();
  const params = route.params || {};
  // Responsive dimensions - using responsive utilities
  const { width: screenWidth } = useDimensions();
  const { cartItems, getLineQuantity, updateQuantity, removeFromCart } = useCart();
  const { fetchCategoryPayloadCached } = useCatalogCache();

  // Use params if provided, otherwise use props. Avoid placeholder id so API isn't called with invalid id.
  const finalCategoryName = (params.categoryName as string) || categoryName || 'Category';
  const finalCategoryId = (params.categoryId as string) || categoryId || '';

  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [apiProducts, setApiProducts] = useState<CategoryPayloadProduct[]>([]);
  const [baseCategoryProducts, setBaseCategoryProducts] = useState<CategoryPayloadProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryDisplayName, setCategoryDisplayName] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const initialLoadDone = useRef(false);
  /** Skips redundant refetch when the initial load already populated products for this category + subcategory. */
  const lastSubFetchKeyRef = useRef<string>('');

  // Track selected variant for each product (for synchronization)
  const [productSelectedVariants, setProductSelectedVariants] = useState<Record<string, string>>({});

  const mapApiProductToProduct = useCallback((p: CategoryPayloadProduct): Product => {
    const rows = variantRowsFromApiProduct(p);
    const firstVariantWithImage = rows.find(
      (v) => v.imageUrl || v.thumbnailUrl || v.cardImageUrl || (v.images && v.images.length > 0),
    );
    const imageInput = {
      ...p,
      imageUrl: p.imageUrl ?? firstVariantWithImage?.imageUrl,
      thumbnailUrl: p.thumbnailUrl ?? firstVariantWithImage?.thumbnailUrl,
      cardImageUrl: p.cardImageUrl ?? firstVariantWithImage?.cardImageUrl,
      images:
        Array.isArray(p.images) && p.images.length > 0
          ? p.images
          : firstVariantWithImage?.images,
    };
    logger.debug('Category payload raw product image URL', {
      productId: p.id,
      name: p.name,
      thumbnailUrl: imageInput.thumbnailUrl,
      cardImageUrl: imageInput.cardImageUrl,
      imageUrl: imageInput.imageUrl,
      firstImage: Array.isArray(imageInput.images) ? imageInput.images[0] : undefined,
    });
    return {
      id: p.id,
      name: p.name,
      image: getProductImageSource(imageInput),
      imageCatalog: productImageCatalogFromApi(imageInput),
      price: p.price,
      originalPrice: resolveProductOriginalPrice(p as any),
      discount: formatProductDiscountLabel(p as any),
      quantity: p.quantity || (rows[0]?.size ?? ''),
      variants: rows,
    };
  }, []);

  const mapSlugProductToProduct = useCallback((p: any): Product => {
    const id = String(p.id ?? p._id ?? '');
    logger.debug('Category slug payload raw product image URL', {
      productId: id,
      name: p.name,
      imageUrl: p.imageUrl,
      image: p.image,
      firstImage: Array.isArray(p.images) ? p.images[0] : undefined,
    });
    const rows = variantRowsFromApiProduct({ ...p, id });
    const label = formatProductDiscountLabel(p);
    const tagFallback = String(p.tag ?? '').trim();
    return {
      id,
      name: String(p.name ?? ''),
      image: getProductImageSource({ imageUrl: p.imageUrl ?? p.image, name: p.name, id }),
      imageCatalog: productImageCatalogFromApi({ ...p, id }),
      price: Number(p.price ?? 0),
      originalPrice: resolveProductOriginalPrice(p),
      discount: label || tagFallback,
      quantity: String(p.size ?? p.quantity ?? rows[0]?.size ?? ''),
      variants: rows,
    };
  }, []);

  const loadSubcategoryProductsWithFallback = useCallback(
    async (subCategoryId: string) => {
      // Primary path: id-based API
      const res = await fetchCategoryPayloadCached(finalCategoryId, subCategoryId);
      const primaryProducts = res?.data?.products ?? [];
      if (Array.isArray(primaryProducts) && primaryProducts.length > 0) {
        setApiProducts(primaryProducts);
        setProducts(primaryProducts.map(mapApiProductToProduct));
        return;
      }

      // Secondary path: slug-based API (some environments return empty product arrays on id query)
      const selectedSub = subCategories.find((s) => s.id === subCategoryId);
      if (!categorySlug || !selectedSub?.slug) {
        setApiProducts(baseCategoryProducts);
        setProducts(baseCategoryProducts.map(mapApiProductToProduct));
        return;
      }
      const fallbackRes = await categoryService.getCategoryProductsBySlug(categorySlug, selectedSub.slug);
      const fallbackProducts = fallbackRes?.data?.products ?? fallbackRes?.products ?? [];
      const safeFallbackProducts = Array.isArray(fallbackProducts) ? fallbackProducts : [];
      if (safeFallbackProducts.length > 0) {
        setApiProducts([]);
        setProducts(safeFallbackProducts.map(mapSlugProductToProduct));
      } else {
        // Final fallback: keep/show category-level products instead of rendering an empty grid.
        setApiProducts(baseCategoryProducts);
        setProducts(baseCategoryProducts.map(mapApiProductToProduct));
      }
    },
    [baseCategoryProducts, categorySlug, fetchCategoryPayloadCached, finalCategoryId, mapApiProductToProduct, mapSlugProductToProduct, subCategories]
  );

  // Category API: load category payload when finalCategoryId is set (and not using fetch props)
  useEffect(() => {
    if (fetchSubCategories ?? fetchBanners ?? fetchProducts) {
      setLoading(false);
      return;
    }
    if (!finalCategoryId || finalCategoryId.trim() === '') {
      setLoading(false);
      setError('Select a category from Home to view products.');
      setCategoryDisplayName(null);
      setSubCategories([]);
      setBanners([]);
      setProducts([]);
      return;
    }
    let cancelled = false;
    lastSubFetchKeyRef.current = '';
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetchCategoryPayloadCached(finalCategoryId);
        if (cancelled || !res?.success || !res.data) return;
        const { category: _c, subcategories: sc, banners: b, products: pr } = res.data;
        const safeSubCategories = Array.isArray(sc) ? sc : [];
        const safeBanners = Array.isArray(b) ? b : [];
        const safeProducts = Array.isArray(pr) ? pr : [];
        const slug = (_c as { slug?: string })?.slug ?? null;

        if (_c?.name) setCategoryDisplayName(_c.name);
        setCategorySlug(slug ?? null);
        setSubCategories(
          safeSubCategories.map((s) => ({
            id: s.id,
            name: s.name,
            slug: (s as { slug?: string }).slug,
            imageUrl: s.imageUrl,
            thumbnailUrl: s.thumbnailUrl,
            cardImageUrl: s.cardImageUrl,
          }))
        );
        setBanners(
          safeBanners.map((x) => ({
            id: x.id,
            image: getProductImageSource({ imageUrl: x.imageUrl, name: x.title ?? undefined, id: x.id }),
            link: x.link ?? null,
            redirectType: x.redirectType ?? null,
            redirectValue: x.redirectValue ?? null,
          }))
        );
        setBaseCategoryProducts(safeProducts);

        const firstSubCategoryId = safeSubCategories[0]?.id ?? null;
        initialLoadDone.current = true;

        if (firstSubCategoryId) {
          setSelectedSubCategoryId(firstSubCategoryId);
          const subKey = `${finalCategoryId}:${firstSubCategoryId}`;
          try {
            const subRes = await fetchCategoryPayloadCached(finalCategoryId, firstSubCategoryId);
            if (cancelled) return;
            const subProducts = Array.isArray(subRes?.data?.products) ? subRes.data.products : [];
            if (subProducts.length > 0) {
              lastSubFetchKeyRef.current = subKey;
              setApiProducts(subProducts);
              setProducts(subProducts.map(mapApiProductToProduct));
              return;
            }
            const firstSlug = (safeSubCategories[0] as { slug?: string })?.slug;
            if (slug && firstSlug) {
              const fb = await categoryService.getCategoryProductsBySlug(slug, firstSlug);
              if (cancelled) return;
              const fbProducts = fb?.data?.products ?? fb?.products ?? [];
              const safeFb = Array.isArray(fbProducts) ? fbProducts : [];
              if (safeFb.length > 0) {
                lastSubFetchKeyRef.current = subKey;
                setApiProducts([]);
                setProducts(safeFb.map(mapSlugProductToProduct));
                return;
              }
            }
            lastSubFetchKeyRef.current = subKey;
            setApiProducts(safeProducts);
            setProducts(safeProducts.map(mapApiProductToProduct));
          } catch (subErr) {
            if (!cancelled) {
              logger.warn('Initial subcategory products failed; using category-level list', {
                message: getApiErrorMessage(subErr, 'Subcategory load failed'),
              });
              lastSubFetchKeyRef.current = subKey;
              setApiProducts(safeProducts);
              setProducts(safeProducts.map(mapApiProductToProduct));
            }
          }
        } else {
          setSelectedSubCategoryId(null);
          setApiProducts(safeProducts);
          setProducts(safeProducts.map(mapApiProductToProduct));
        }
      } catch (err) {
        if (!cancelled) {
          const msg = getApiErrorMessage(err, 'Failed to load category');
          logger.error('Category payload failed', { message: msg, status: (err as { status?: number })?.status });
          setError(msg);
          setCategoryDisplayName(null);
          setSubCategories([]);
          setBanners([]);
          setBaseCategoryProducts([]);
          setProducts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [finalCategoryId, fetchCategoryPayloadCached, fetchSubCategories, fetchBanners, fetchProducts, mapApiProductToProduct, mapSlugProductToProduct]);

  // When user selects a subcategory, refetch products for that subcategory
  useEffect(() => {
    if (!initialLoadDone.current || selectedSubCategoryId === null) return;
    if (fetchProducts) return;
    const fetchKey = `${finalCategoryId}:${selectedSubCategoryId}`;
    if (lastSubFetchKeyRef.current === fetchKey) return;
    let cancelled = false;
    setLoading(true);
    loadSubcategoryProductsWithFallback(selectedSubCategoryId)
      .then(() => {
        if (cancelled) return;
        lastSubFetchKeyRef.current = fetchKey;
      })
      .catch(async (err) => {
        if (cancelled) return;
        const msg = getApiErrorMessage(err, 'Failed to load products');
        logger.warn('Category products by subcategory failed; trying slug fallback', { message: msg });

        // Production hardening: fallback to slug-based endpoint on request errors.
        try {
          const selectedSub = subCategories.find((s) => s.id === selectedSubCategoryId);
          if (!categorySlug || !selectedSub?.slug) throw new Error('Missing categorySlug or selected subcategory slug');

          const fallbackRes = await categoryService.getCategoryProductsBySlug(categorySlug, selectedSub.slug);
          const fallbackProducts = fallbackRes?.data?.products ?? fallbackRes?.products ?? [];
          const safeFb = Array.isArray(fallbackProducts) ? fallbackProducts : [];

          // We may not have variants from this endpoint, so the variant modal will use computed dummy variants.
          setApiProducts([]);
          setProducts(safeFb.map(mapSlugProductToProduct));
          if (safeFb.length > 0) lastSubFetchKeyRef.current = fetchKey;
        } catch (fallbackErr) {
          logger.error('Category products fallback failed', { message: getApiErrorMessage(fallbackErr, 'Fallback failed') });
          setApiProducts([]);
          setProducts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [categorySlug, fetchProducts, finalCategoryId, loadSubcategoryProductsWithFallback, selectedSubCategoryId, subCategories]);

  // Optional fetch props (override API when provided)
  useEffect(() => {
    if (fetchSubCategories) {
      const loadSubCategories = async () => {
        setLoading(true);
        try {
          const data = await fetchSubCategories();
          setSubCategories(data);
          if (data.length > 0) setSelectedSubCategoryId(data[0].id);
        } catch (err) {
          logger.error('Error fetching sub-categories', err);
          setSubCategories([]);
        } finally {
          setLoading(false);
        }
      };
      loadSubCategories();
    }
  }, [fetchSubCategories]);

  useEffect(() => {
    if (fetchBanners) {
      const loadBanners = async () => {
        try {
          const data = await fetchBanners();
          setBanners(data);
        } catch (err) {
          logger.error('Error fetching banners', err);
          setBanners([]);
        }
      };
      loadBanners();
    }
  }, [fetchBanners]);

  useEffect(() => {
    if (fetchProducts) {
      const loadProducts = async () => {
        if (selectedSubCategoryId == null) return;
        setLoading(true);
        try {
          const data = await fetchProducts(selectedSubCategoryId);
          setProducts(data);
        } catch (err) {
          logger.error('Error fetching products', err);
          setProducts([]);
        } finally {
          setLoading(false);
        }
      };
      loadProducts();
    }
  }, [selectedSubCategoryId, fetchProducts]);

  const handleBackPress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleSearch = useCallback(() => {
    if (onSearchPress) {
      onSearchPress();
    } else {
      navigation.navigate('Search');
    }
  }, [navigation, onSearchPress]);

  const handleSubCategoryPress = useCallback((subCategoryId: string) => {
    setSelectedSubCategoryId(subCategoryId);
  }, []);

  const handleBannerPress = useCallback(
    (banner: BannerItem) => {
      try {
        if (!bannerIsTapEnabled(banner)) {
          return;
        }
        if (banner.redirectType && banner.redirectValue) {
          // Use typed redirect handler for CMS redirect objects
          handleRedirect({ redirectType: banner.redirectType, redirectValue: banner.redirectValue }, navigation);
          return;
        }
        if (banner.link && typeof banner.link === 'string') {
          handleHomeLink(banner.link, navigation);
          return;
        }
        // If banner.link exists but is not a string, ignore it (defensive)
        if (banner.link) {
          logger.warn('Banner link ignored - unexpected type', { link: banner.link });
        }
      } catch (err) {
        logger.error('Error handling banner press', { error: err });
      }
    },
    [navigation]
  );

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

  const handleAddToCart = (variantId: string) => {
    if (selectedProductId) {
      // Update selected variant when adding to cart (synchronization)
      setProductSelectedVariants(prev => ({
        ...prev,
        [selectedProductId]: variantId,
      }));
    }
  };
  
  // Sync selected variants from cart when modal opens
  useEffect(() => {
    if (modalVisible && selectedProductId) {
      const prod = products.find((p) => p.id === selectedProductId);
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
  }, [modalVisible, selectedProductId, cartItems, products]);
  
  // Sync selected variants for all products when cart changes
  // This ensures product card shows quantity selector automatically when item is added from dropdown
  useEffect(() => {
    products.forEach(product => {
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
  }, [cartItems, products]);

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

  const handleHomePress = () => {
    navigation.navigate('MainTabs', { screen: 'Home' });
  };

  const handleShopPress = () => {
    navigation.navigate('Category');
  };

  const handleCartPress = () => {
    navigation.navigate('Checkout');
  };

  const sidebarWidth = scale(72); // Keep aligned with styles.sidebar.width

  // Calculate product card width for 2-column grid (minimum 2 cards per row)
  const containerPadding = getSpacing(12) * 2; // Left and right padding (from productsContent)
  const columnGap = getSpacing(16); // Column gap between cards (horizontal)
  const productCardWidth = Math.floor(getTwoColumnCardWidth(screenWidth, {
    sidebarWidth,
    horizontalPadding: containerPadding,
    columnGap,
  }) - 0.5); // Subtract 0.5 to ensure it fits in all screen ratios/rounding scenarios

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackPress}
            activeOpacity={0.7}
          >
            <BackIcon />
          </TouchableOpacity>

          {/* Title Container */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{categoryDisplayName ?? finalCategoryName}</Text>
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

        {/* Main Content Container */}
        <View style={styles.mainContent}>
          {/* Sub-Category Sidebar - starts from below header */}
          <View style={styles.sidebar}>
            <ScrollView
              style={styles.sidebarScroll}
              contentContainerStyle={styles.sidebarContent}
              showsVerticalScrollIndicator={false}
            >
              {subCategories.map((subCategory) => (
                <SubCategoryItem
                  key={subCategory.id}
                  id={subCategory.id}
                  name={subCategory.name}
                  imageUrl={subCategory.imageUrl}
                  thumbnailUrl={subCategory.thumbnailUrl}
                  cardImageUrl={subCategory.cardImageUrl}
                  isSelected={selectedSubCategoryId === subCategory.id}
                  onPress={handleSubCategoryPress}
                />
              ))}
            </ScrollView>
          </View>

          {/* Products Grid */}
          <View style={styles.productsContainer}>
            {loading && subCategories.length === 0 && !error ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2D5016" />
                <Text style={styles.loadingText}>Loading…</Text>
              </View>
            ) : error && subCategories.length === 0 ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : (
            <ScrollView
              style={styles.productsScroll}
              contentContainerStyle={[
                styles.productsContent,
                { paddingBottom: 80 }, // Add padding to prevent content from being hidden behind bottom nav
              ]}
              showsVerticalScrollIndicator={false}
            >
              {/* Scrollable Banner */}
              <CategoryBanner banners={banners} onBannerPress={handleBannerPress} />

              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#2D5016" />
                </View>
              ) : null}

              {/* Product Grid - 2 columns */}
              {!loading && subCategories.length > 0 && selectedSubCategoryId === null ? (
                <View style={styles.emptySubCategoryContainer}>
                  <Text style={styles.emptySubCategoryText}>Select a subcategory to view products.</Text>
                </View>
              ) : (
                <View style={styles.productsGrid}>
                  {products.length > 0 ? (
                    products.map((product, index) => (
                      <View
                        key={product.id}
                        style={[
                          styles.productCardWrapper,
                          { width: productCardWidth },
                        ]}
                      >
                        <View style={styles.productCardInner}>
                          <ProductCard
                            product={product}
                            onQuantityPress={handleQuantityPress}
                            onAddPress={handleAddPress}
                            onCardPress={handleCardPress}
                            width={productCardWidth}
                            selectedVariantId={productSelectedVariants[product.id]}
                          />
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptySubCategoryContainer}>
                      <Text style={styles.emptySubCategoryText}>No products found in this category.</Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
            )}
          </View>
        </View>

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
    backgroundColor: '#F5F5F5',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    width: 32,
    height: 32,
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
  mainContent: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
  },
  sidebar: {
    width: scale(72),
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: 'rgba(209, 209, 209, 0.5)',
    paddingVertical: 0,
    gap: 4,
  },
  sidebarScroll: {
    flex: 1,
  },
  sidebarContent: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    paddingBottom: 12,
    gap: 8,
  },
  productsContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  productsScroll: {
    flex: 1,
  },
  productsContent: {
    padding: getSpacing(12),
    paddingTop: 16,
    gap: 12,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: getSpacing(16), // Column gap (horizontal) between cards
  },
  productCardWrapper: {
    marginBottom: 12, // Row gap (vertical) between cards
  },
  productCardInner: {
    width: '100%',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  loadingRow: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 14,
    color: '#B00020',
    textAlign: 'center',
  },
  emptySubCategoryContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: 260,
    width: '100%',
  },
  emptySubCategoryText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

