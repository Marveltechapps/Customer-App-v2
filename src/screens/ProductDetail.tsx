import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageSourcePropType,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RootStackNavigationProp, RootStackRouteProp } from '../types/navigation';
import BackIcon from '../components/icons/BackIcon';
import SearchIcon from '../components/icons/SearchIcon';
import Text from '../components/common/Text';
import { logger } from '@/utils/logger';
import RupeeIcon from '../components/icons/RupeeIcon';
import PlusIcon from '../components/icons/PlusIcon';
import MinusIcon from '../components/icons/MinusIcon';
import DropdownArrowIcon from '../components/icons/DropdownArrowIcon';
import ProductCard, { Product } from '../components/features/product/ProductCard';
import ProductInformationSection from '../components/features/product/ProductInformationSection';
import ProductVariantModal, { ProductVariant } from '../components/features/product/ProductVariantModal';
import FloatingCartBar from '../components/features/cart/FloatingCartBar';
import { useCart } from '@/contexts/CartContext';
import * as productService from '../services/products/productService';
import { getApiErrorMessage } from '../services/api/types';
import { getImageFitFromUrl, getProductImageSource, getProductImageUrl } from '../utils/productImage';
import {
  variantRowsFromApiProduct,
  buildModalVariantsFromRows,
  fetchModalVariantsForProduct,
  dedupeProductsByProductLine,
  type ProductVariantRow,
} from '@/utils/productVariants';
import {
  normalizeDescriptionFromApi,
  enrichDescriptionWithMeta,
  descriptionFallbackText,
  buildProductInformationBlocks,
  type NormalizedDescription,
} from '@/utils/productDescription';
import { Theme } from '../constants/Theme';
import { Colors } from '../constants/Colors';
import { addOrIncrementCartLine } from '@/utils/cartActions';
import { isVariantRowInCart } from '@/utils/productCardCart';

const SECTION_CARD_GAP = Theme.spacing.sectionCardGap;

const SCREEN_WIDTH = Dimensions.get('window').width;
/** Fixed hero band height; image uses cover to fill the band (may crop edges). */
const PRODUCT_IMAGE_HEIGHT = 272;

function isMongoObjectId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

/** Build image sources from API fields (images[], imageUrl, additionalImages). */
function buildImageSources(product: any): ImageSourcePropType[] {
  if (!product) {return [];}
  const urls: string[] = [];
  if (typeof product.imageUrl === 'string' && product.imageUrl.trim()) {
    urls.push(product.imageUrl.trim());
  }
  if (Array.isArray(product.images)) {
    urls.push(...product.images.filter((u: unknown) => typeof u === 'string' && u.trim()));
  }
  if (Array.isArray(product.additionalImages)) {
    urls.push(...product.additionalImages.filter((u: unknown) => typeof u === 'string' && u.trim()));
  }
  logger.debug('Product detail raw image URLs from API', {
    productId: product?._id ?? product?.id,
    name: product?.name,
    imageUrl: product?.imageUrl,
    imagesCount: Array.isArray(product?.images) ? product.images.length : 0,
    additionalImagesCount: Array.isArray(product?.additionalImages) ? product.additionalImages.length : 0,
    firstImage: Array.isArray(product?.images) ? product.images[0] : undefined,
  });
  const seen = new Set<string>();
  const out: ImageSourcePropType[] = [];
  for (const u of urls) {
    const s = String(u);
    if (seen.has(s)) {continue;}
    seen.add(s);
    out.push(getProductImageSource({ ...product, images: [s], imageUrl: s }));
  }
  if (out.length === 0) {
    out.push(getProductImageSource(product));
  }
  return out;
}

function formatDiscount(product: any): string {
  const existing = product?.discount;
  if (existing != null && String(existing).trim()) {return String(existing);}
  const mrp = Number(product?.mrp || product?.originalPrice || 0);
  const price = Number(product?.price || 0);
  if (mrp > 0 && price > 0 && mrp > price) {
    const pct = Math.round(((mrp - price) / mrp) * 100);
    return pct > 0 ? `${pct}% OFF` : '';
  }
  return '';
}

interface ProductDetail {
  id: string;
  backendId?: string;
  name: string;
  images: ImageSourcePropType[];
  price: number;
  originalPrice: number;
  discount: string;
  description: string;
  /** Structured copy from API; used for Product Information blocks. */
  descriptionStructured?: NormalizedDescription;
  deliveryInfo?: string;
  gstRate?: number;
  variants: Array<{
    id: string;
    productId?: string;
    name?: string;
    size: string;
    price: number;
    originalPrice: number;
    imageUrl?: string;
    thumbnailUrl?: string;
    cardImageUrl?: string;
    images?: string[];
  }>;
}

interface SimilarProduct extends Product {
  quantity: string;
}

interface ProductDetailScreenProps {
  productId?: string;
  fetchProductDetail?: (productId: string) => Promise<ProductDetail>;
  fetchSimilarProducts?: (productId: string) => Promise<SimilarProduct[]>;
}

const EMPTY_PRODUCT_DETAIL: ProductDetail = {
  id: '',
  name: '',
  images: [],
  price: 0,
  originalPrice: 0,
  discount: '',
  description: '',
  descriptionStructured: undefined,
  variants: [],
};

export default function ProductDetailScreen({
  productId: propProductId,
  fetchProductDetail,
  fetchSimilarProducts,
}: ProductDetailScreenProps = {} as ProductDetailScreenProps) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<RootStackRouteProp<'ProductDetail'>>();
  const routeParams = route.params || {};
  const { addToCart, updateQuantity, removeFromCart, getLineQuantity, cartItems } = useCart();

  // Get productId from props or params
  const productId = propProductId || routeParams.productId || '';

  // State management
  const [productDetail, setProductDetail] = useState<ProductDetail>(EMPTY_PRODUCT_DETAIL);
  const [similarProducts, setSimilarProducts] = useState<SimilarProduct[]>([]);
  const [productError, setProductError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [similarModalVisible, setSimilarModalVisible] = useState(false);
  const [similarModalProductId, setSimilarModalProductId] = useState<string | null>(null);
  const [similarSelectedVariants, setSimilarSelectedVariants] = useState<Record<string, string>>({});

  // Ref to track variants being added to prevent flicker

  useEffect(() => {
    if (!productId) {
      setProductError('No product selected');
      setLoading(false);
      return;
    }
    setProductError(null);
    setLoading(true);
    setProductDetail(EMPTY_PRODUCT_DETAIL);
    setSimilarProducts([]);
    setSelectedVariantId('');
    setCurrentImageIndex(0);

    const loadProductDetail = async () => {
      try {
        if (fetchProductDetail) {
          const data = await fetchProductDetail(productId);
          setProductDetail(data);
          setSelectedVariantId(data.variants?.[0]?.id || '');
        } else {
          const resp = await productService.getProductDetail(productId);
          if (resp && resp.success && resp.data) {
            const payloadAny = resp.data as any;
            const product = payloadAny?.product ?? payloadAny;
            const variantsRaw = Array.isArray(payloadAny?.variants) ? payloadAny.variants : [];
            const relatedRaw = Array.isArray(payloadAny?.relatedProducts) ? payloadAny.relatedProducts : [];
            const pidStr = String(product?._id || product?.id || productId);
            const pname = String(product?.name || '');
            const embeddedRows = variantRowsFromApiProduct({
              ...product,
              id: pidStr,
              name: pname,
            });
            const normalizedVariants: ProductDetail['variants'] =
              variantsRaw.length > 0
                ? variantRowsFromApiProduct({
                    ...product,
                    id: pidStr,
                    name: pname,
                    variants: variantsRaw,
                  }).map((r) => ({
                    id: r.id,
                    productId: r.productId ?? pidStr,
                    name: r.name,
                    size: r.size,
                    price: Number(r.price ?? 0),
                    originalPrice: Number(r.originalPrice ?? 0),
                    imageUrl: r.imageUrl,
                    thumbnailUrl: r.thumbnailUrl,
                    cardImageUrl: r.cardImageUrl,
                    images: r.images,
                  }))
                : embeddedRows.map((r) => ({
                    id: r.id,
                    productId: r.productId ?? pidStr,
                    name: r.name,
                    size: r.size,
                    price: Number(r.price ?? 0),
                    originalPrice: Number(r.originalPrice ?? 0),
                    imageUrl: r.imageUrl,
                    thumbnailUrl: r.thumbnailUrl,
                    cardImageUrl: r.cardImageUrl,
                    images: r.images,
                  }));
            const descStructured = enrichDescriptionWithMeta(
              normalizeDescriptionFromApi(product?.description),
              typeof product?.meta === 'object' && product?.meta
                ? {
                    title: (product.meta as { title?: string }).title,
                    description: (product.meta as { description?: string }).description,
                  }
                : undefined,
            );
            const normalized: ProductDetail = {
              id: String(product?._id || product?.id || productId),
              backendId: String(product?._id || product?.id || productId),
              name: String(product?.name || ''),
              images: buildImageSources(product),
              price: Number(product?.price || 0),
              originalPrice: Number(product?.mrp || product?.originalPrice || product?.price || 0),
              discount: formatDiscount(product),
              description: descriptionFallbackText(product?.description),
              descriptionStructured: descStructured,
              deliveryInfo: product?.deliveryInfo || '',
              gstRate: typeof product?.gstRate === 'number' ? product.gstRate : typeof product?.taxPercent === 'number' ? product.taxPercent : undefined,
              variants: normalizedVariants,
            };
            setProductDetail(normalized);
            setSelectedVariantId(normalized.variants?.[0]?.id || '');
            setSimilarProducts(
              dedupeProductsByProductLine(relatedRaw, 8).map((p: any) => {
                const sid = String(p._id || p.id);
                const rows = variantRowsFromApiProduct({ ...p, id: sid });
                return {
                  id: sid,
                  name: String(p.name || ''),
                  image: getProductImageSource(p),
                  price: Number(p.price || 0),
                  originalPrice: Number(p.mrp || p.originalPrice || p.price || 0),
                  discount: String(p.discount || formatDiscount(p)),
                  quantity: String(p.size || p.quantity || rows[0]?.size || ''),
                  variants: rows,
                  gstRate: typeof p.gstRate === 'number' ? p.gstRate : typeof p.taxPercent === 'number' ? p.taxPercent : undefined,
                  hierarchyCode: typeof p.hierarchyCode === 'string' ? p.hierarchyCode : undefined,
                };
              })
            );
          } else {
            setProductError('Product not found');
          }
        }
      } catch (err) {
        const msg = getApiErrorMessage(err, 'Failed to load product');
        logger.error('Product detail failed', { message: msg });
        setProductError(msg);
      } finally {
        setLoading(false);
      }
    };

    loadProductDetail();
  }, [productId, fetchProductDetail]);

  useEffect(() => {
    const loadSimilarProducts = async () => {
      if (fetchSimilarProducts) {
        try {
          const data = await fetchSimilarProducts(productId);
          setSimilarProducts(dedupeProductsByProductLine(data, 8));
        } catch (err) {
          const msg = getApiErrorMessage(err, 'Failed to load similar products');
          logger.error('Similar products failed', { message: msg });
          setSimilarProducts([]);
        }
      }
    };

    loadSimilarProducts();
  }, [productId, fetchSimilarProducts]);

  useEffect(() => {
    similarProducts.forEach((product) => {
      const productVariants = variantRowsFromApiProduct(product);
      const variantInCart = productVariants.find((v) =>
        isVariantRowInCart(cartItems, v, product.id),
      );
      if (variantInCart) {
        setSimilarSelectedVariants((prev) => {
          if (!prev[product.id] || prev[product.id] !== variantInCart.id) {
            return { ...prev, [product.id]: variantInCart.id };
          }
          return prev;
        });
      }
    });
  }, [cartItems, similarProducts]);

  const productInformationBlocks = useMemo(
    () =>
      buildProductInformationBlocks(
        productDetail.descriptionStructured ?? productDetail.description,
      ),
    [productDetail.descriptionStructured, productDetail.description],
  );

  // Get selected variant
  const selectedVariant = productDetail.variants.find((v) => v.id === selectedVariantId) || productDetail.variants[0];
  const variantPrice = selectedVariant?.price || productDetail.price;
  const variantOriginalPrice = selectedVariant?.originalPrice || productDetail.originalPrice;

  const lineProductId = selectedVariant?.productId ?? productDetail.id;
  const cartQuantity = selectedVariantId
    ? getLineQuantity(lineProductId, selectedVariantId)
    : 0;
  const hasQuantity = cartQuantity > 0;

  // Navigation handlers
  const handleBack = () => {
    navigation.goBack();
  };

  const handleVariantSelect = (variantId: string) => {
    setSelectedVariantId(variantId);
    const row = productDetail.variants.find((v) => v.id === variantId);
    const targetPid = row?.productId;
    if (targetPid && targetPid !== productDetail.id && isMongoObjectId(targetPid)) {
      navigation.replace('ProductDetail', { productId: targetPid });
    }
  };

  // Add to cart handler (for Add button on page)
  const handleAddToCart = () => {
    if (selectedVariantId && selectedVariant) {
      addOrIncrementCartLine(addToCart, updateQuantity, getLineQuantity, {
        variantId: selectedVariantId,
        productId: selectedVariant.productId ?? productDetail.id,
        productName: productDetail.name,
        variantSize: selectedVariant.size,
        image: currentImage,
        price: variantPrice,
        originalPrice: variantOriginalPrice,
        discount: productDetail.discount,
        gstRate: typeof productDetail.gstRate === 'number' ? productDetail.gstRate : 0,
      });
    }
  };

  // Quantity change handlers
  const handleDecrease = () => {
    if (selectedVariantId && cartQuantity > 0) {
      const newQuantity = cartQuantity - 1;
      if (newQuantity <= 0) {
        removeFromCart(lineProductId, selectedVariantId);
      } else {
        updateQuantity(lineProductId, selectedVariantId, newQuantity);
      }
    }
  };

  const handleIncrease = () => {
    if (selectedVariantId && cartQuantity >= 0) {
      const newQuantity = cartQuantity + 1;
      updateQuantity(lineProductId, selectedVariantId, newQuantity);
    }
  };

  // Handle image scroll to update current index
  const handleImageScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / SCREEN_WIDTH);
    setCurrentImageIndex(index);
  };

  // Get current image for cart (use first image)
  const currentImage = productDetail.images[currentImageIndex] || productDetail.images[0];

  // Convert productDetail variants to ProductVariant format for modal (per-SKU images from API when present)
  const getProductVariants = (): ProductVariant[] => {
    const fallbackImg =
      productDetail.images[0] ||
      getProductImageSource({ name: productDetail.name, id: productDetail.id });
    return buildModalVariantsFromRows(
      {
        image: fallbackImg,
        discount: productDetail.discount,
        price: productDetail.price,
        originalPrice: productDetail.originalPrice,
        name: productDetail.name,
        id: productDetail.id,
      },
      productDetail.variants as ProductVariantRow[],
      getLineQuantity,
      productDetail.id,
    );
  };

  const similarModalProduct = similarProducts.find((p) => p.id === similarModalProductId);

  const getSimilarModalVariants = (): ProductVariant[] => {
    if (!similarModalProduct) {return [];}
    const rows = variantRowsFromApiProduct(similarModalProduct);
    return buildModalVariantsFromRows(
      {
        image: similarModalProduct.image,
        discount: similarModalProduct.discount,
        price: similarModalProduct.price,
        originalPrice: similarModalProduct.originalPrice,
        name: similarModalProduct.name,
        id: similarModalProduct.id,
      },
      rows,
      getLineQuantity,
      similarModalProduct.id,
    );
  };

  const fetchSimilarModalVariantsFromApi = useCallback(async () => {
    if (!similarModalProductId) {return [];}
    return fetchModalVariantsForProduct(similarModalProductId, getLineQuantity);
  }, [similarModalProductId, getLineQuantity]);

  const handleSimilarModalClose = () => {
    setSimilarModalVisible(false);
    setSimilarModalProductId(null);
  };

  const handleSimilarVariantSelect = (variantId: string) => {
    if (!similarModalProductId) {return;}
    const sp = similarProducts.find((p) => p.id === similarModalProductId);
    if (!sp) {return;}
    const rows = variantRowsFromApiProduct(sp);
    const row = rows.find((r) => r.id === variantId);
    setSimilarSelectedVariants((prev) => ({ ...prev, [similarModalProductId]: variantId }));
    const targetPid = row?.productId;
    if (targetPid && targetPid !== sp.id && isMongoObjectId(targetPid)) {
      navigation.replace('ProductDetail', { productId: targetPid });
      handleSimilarModalClose();
    }
  };

  const handleSimilarAddToCart = (variantId: string) => {
    if (!similarModalProductId) {return;}
    setSimilarSelectedVariants((prev) => ({ ...prev, [similarModalProductId]: variantId }));
  };

  // Handle dropdown click to open modal
  const handleDropdownPress = () => {
    setModalVisible(true);
  };

  // Handle modal close
  const handleCloseModal = () => {
    setModalVisible(false);
  };

  // Handle add to cart from modal
  const handleModalAddToCart = (variantId: string) => {
    // The modal itself updates cart quantity; here we only sync local selection.
    // Do NOT navigate/replace on "Add" from the sheet.
    if (productDetail.variants.some((v) => v.id === variantId)) {
      setSelectedVariantId(variantId);
    }
  };

  const handleModalQuantityChange = (variantId: string, quantity: number) => {
    const mainRow = productDetail.variants.find((v) => v.id === variantId);
    if (mainRow) {
      const pid = mainRow.productId ?? productDetail.id;
      if (quantity <= 0) {
        removeFromCart(pid, variantId);
      } else {
        updateQuantity(pid, variantId, quantity);
      }
      return;
    }
    for (const sp of similarProducts) {
      const rows = variantRowsFromApiProduct(sp);
      const row = rows.find((r) => r.id === variantId);
      if (row) {
        const pid = row.productId ?? sp.id;
        if (quantity <= 0) {
          removeFromCart(pid, variantId);
        } else {
          updateQuantity(pid, variantId, quantity);
        }
        return;
      }
    }
  };

  if (loading && !productDetail.id) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <BackIcon />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#666' }}>Loading product...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (productError || !productDetail.id) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <BackIcon />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Text style={{ fontSize: 16, color: '#666', textAlign: 'center' }}>
              {productError || 'Product not found'}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <BackIcon />
          </TouchableOpacity>
          <View style={styles.headerSpacer} />
          <TouchableOpacity style={styles.searchButton}>
            <SearchIcon width={20} height={20} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Product Images Carousel */}
          <View style={styles.productImageContainer}>
            <FlatList
              data={productDetail.images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.productImageCarousel}
              keyExtractor={(item, index) => `image-${index}`}
              onScroll={handleImageScroll}
              scrollEventThrottle={16}
              getItemLayout={(_, index) => ({
                length: SCREEN_WIDTH,
                offset: SCREEN_WIDTH * index,
                index,
              })}
              renderItem={({ item }: { item: ImageSourcePropType }) => (
                <View style={[styles.imageWrapper, { width: SCREEN_WIDTH }]}>
                  <Image
                    source={item}
                    style={styles.productImageCover}
                    resizeMode={
                      typeof item === 'object' && item != null && 'uri' in item
                        ? getImageFitFromUrl((item as { uri?: string }).uri)
                        : 'contain'
                    }
                    onError={() => {
                      const failingUri =
                        typeof item === 'object' && item != null && 'uri' in item
                          ? (item as { uri?: string }).uri
                          : 'local-asset';
                      logger.error('Product detail hero image failed to load', {
                        productId: productDetail.id,
                        imageIndex: currentImageIndex,
                        uri: failingUri,
                      });
                    }}
                  />
                </View>
              )}
            />
            {/* Dot Indicators - Only show if more than 1 image */}
            {productDetail.images.length > 1 && (
              <View style={styles.dotContainer}>
                {productDetail.images.map((_, index) => (
                  <View
                    key={`dot-${index}`}
                    style={[
                      styles.dot,
                      index === currentImageIndex ? styles.activeDot : styles.inactiveDot,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Product Info Card */}
          <View style={styles.productInfoCard}>
            {/* Product Name and Price */}
            <View style={styles.productHeader}>
              {!!productDetail.name && (
                <Text style={styles.productName} numberOfLines={3}>
                  {productDetail.name}
                </Text>
              )}
              <View style={styles.priceContainer}>
                <View style={styles.discountAndPriceContainer}>
                  {!!productDetail.discount && (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountText}>{productDetail.discount}</Text>
                  </View>
                  )}
                  <View style={styles.priceRow}>
                    <View style={styles.currentPriceContainer}>
                      <RupeeIcon size={11} color="#222222" />
                      <Text style={styles.currentPrice}>{variantPrice}</Text>
                    </View>
                    <View style={styles.originalPriceContainer}>
                      <View style={styles.originalPriceRow}>
                        <RupeeIcon size={8} color="#777777" />
                        <Text style={styles.originalPrice}>{variantOriginalPrice}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Size Selector and Add Button */}
            <View style={styles.actionContainer}>
              {/* Size Selector */}
              <TouchableOpacity style={styles.sizeSelector} onPress={handleDropdownPress}>
                <Text style={styles.sizeText}>{selectedVariant?.size || '1 unit'}</Text>
                <View style={styles.dropdownIconWrapper}>
                  <DropdownArrowIcon />
                </View>
              </TouchableOpacity>

              {/* Add/Quantity Button */}
              {!hasQuantity ? (
                <TouchableOpacity style={styles.addButton} onPress={handleAddToCart}>
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.quantityContainer}>
                  <TouchableOpacity style={styles.quantityButton} onPress={handleDecrease}>
                    <MinusIcon width={16} height={16} color="#FFFFFF" />
                  </TouchableOpacity>
                  <View style={styles.quantityTextContainer}>
                    <Text style={styles.quantityText}>{cartQuantity}</Text>
                  </View>
                  <TouchableOpacity style={styles.quantityButton} onPress={handleIncrease}>
                    <PlusIcon width={16} height={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          <ProductInformationSection blocks={productInformationBlocks} />

          {/* Similar Products Section */}
          <View style={styles.similarProductsCard}>
            <View style={styles.similarProductsHeader}>
              <Text style={styles.similarProductsTitle}>Similar products</Text>
              <View style={styles.dividerLine} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarProductsScroll}>
              {similarProducts.map((product) => (
                <View key={product.id} style={styles.similarProductCard}>
                  <ProductCard
                    product={product}
                    onCardPress={() => {
                      setSimilarModalProductId(product.id);
                      setSimilarModalVisible(true);
                    }}
                    selectedVariantId={similarSelectedVariants[product.id]}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        </ScrollView>

        {/* Floating Cart Bar */}
        <FloatingCartBar onPress={() => navigation.navigate('Checkout')} hasBottomNav={false} />

        {/* Product Variant Modal */}
        <ProductVariantModal
          visible={modalVisible}
          productName={productDetail.name}
          productId={productDetail.id}
          variants={getProductVariants()}
          gstRate={typeof productDetail.gstRate === 'number' ? productDetail.gstRate : 0}
          onClose={handleCloseModal}
          onVariantSelect={handleVariantSelect}
          onAddToCart={handleModalAddToCart}
          onQuantityChange={handleModalQuantityChange}
        />

        {similarModalProduct && (
          <ProductVariantModal
            visible={similarModalVisible}
            productName={similarModalProduct.name}
            productId={similarModalProduct.id}
            variants={getSimilarModalVariants()}
            fetchVariants={fetchSimilarModalVariantsFromApi}
            gstRate={typeof similarModalProduct.gstRate === 'number' ? similarModalProduct.gstRate : 0}
            onClose={handleSimilarModalClose}
            onVariantSelect={handleSimilarVariantSelect}
            onAddToCart={handleSimilarAddToCart}
            onQuantityChange={handleModalQuantityChange}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

// Calculate screen width for dynamic styles
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSpacer: {
    flex: 1,
  },
  searchButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    paddingBottom: SECTION_CARD_GAP,
    backgroundColor: '#F5F5F5',
  },
  productImageContainer: {
    width: '100%',
    height: PRODUCT_IMAGE_HEIGHT,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    overflow: 'hidden',
  },
  productImageCarousel: {
    height: PRODUCT_IMAGE_HEIGHT,
  },
  imageWrapper: {
    height: PRODUCT_IMAGE_HEIGHT,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  productImageCover: {
    ...StyleSheet.absoluteFillObject,
  },
  dotContainer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    backgroundColor: '#2C512C',
  },
  inactiveDot: {
    backgroundColor: '#FFFFFF',
  },
  productInfoCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.6,
    borderColor: '#F4F4F4',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: SECTION_CARD_GAP,
    marginTop: SECTION_CARD_GAP,
    marginBottom: 0,
    gap: 16,
    alignSelf: 'stretch',
  },
  productHeader: {
    gap: 8,
    alignSelf: 'stretch',
  },
  productName: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    color: '#222222',
    fontFamily: 'Inter',
  },
  priceContainer: {
    gap: 16,
    alignSelf: 'stretch',
  },
  discountAndPriceContainer: {
    flexDirection: 'column',
    gap: 16,
    alignSelf: 'stretch',
  },
  discountBadge: {
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  discountText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18, // 1.5em * 12
    color: '#FF8C00',
    fontFamily: 'Inter',
    textAlign: 'left',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  currentPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currentPrice: {
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 24, // 1.2em * 20
    color: '#222222',
    fontFamily: 'Inter',
  },
  originalPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    position: 'relative',
    justifyContent: 'center',
  },
  originalPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    position: 'relative',
  },
  originalPrice: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 16.94, // 1.2102272851126534em * 14
    color: '#777777',
    fontFamily: 'Inter',
    textAlign: 'left',
    textDecorationLine: 'line-through',
    textDecorationColor: '#777777',
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'stretch',
    alignSelf: 'stretch',
  },
  sizeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#DFF5E1',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    flex: 1,
  },
  sizeText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20, // 1.4285714285714286em * 14
    color: '#1A1A1A',
    fontFamily: 'Inter',
  },
  dropdownIconWrapper: {
    width: 14,
    height: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    width: 127,
    height: 40,
    backgroundColor: '#3E6B40',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#012D01',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20, // 1.4285714285714286em * 14
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  quantityContainer: {
    width: 127,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3E6B40',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#012D01',
    paddingHorizontal: 12,
    gap: 20,
  },
  quantityButton: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 0,
  },
  quantityTextContainer: {
    flex: 0,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  similarProductsCard: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    marginHorizontal: SECTION_CARD_GAP,
    marginTop: SECTION_CARD_GAP,
    marginBottom: SECTION_CARD_GAP,
    padding: 16,
  },
  similarProductsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  similarProductsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
    fontFamily: 'Inter',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5E5',
  },
  similarProductsScroll: {
    gap: 16,
    paddingRight: 16,
  },
  similarProductCard: {
    width: 126.5,
  },
});

