import React, { useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ImageSourcePropType,
  Pressable,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import CmsRemoteImage, { type CmsImagePriority } from '../../common/CmsRemoteImage';
import { useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '@/types/navigation';
import Text from '../../common/Text';
import RupeeIcon from '../../icons/RupeeIcon';
import PlusIcon from '../../icons/PlusIcon';
import MinusIcon from '../../icons/MinusIcon';
import DropdownArrowIcon from '../../icons/DropdownArrowIcon';
import { useCart } from '@/contexts/CartContext';
import { logger } from '@/utils/logger';
import { variantRowsFromApiProduct, type ProductVariantRow } from '@/utils/productVariants';
import {
  collectProductImageUrlCandidates,
  getImageFitFromUrl,
  type ProductLikeImageInput,
} from '@/utils/productImage';
import { shouldUseLocalPlaceholder } from '@/config/placeholder';
import { addOrIncrementCartLine } from '@/utils/cartActions';
import { buildCartItemPayload, resolveProductCartLine } from '@/utils/productCardCart';

/** Remote or placeholder sentinel URI for CmsRemoteImage (not for native Image URL loading). */
function remoteDisplayUri(src: ImageSourcePropType): string | null {
  if (typeof src === 'object' && src !== null && !Array.isArray(src) && 'uri' in src) {
    const u = (src as { uri?: string }).uri;
    if (typeof u !== 'string') return null;
    const trimmed = u.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (shouldUseLocalPlaceholder(trimmed)) return trimmed;
  }
  return null;
}

export interface Product {
  id: string;
  name: string;
  image: ImageSourcePropType;
  price: number;
  originalPrice: number;
  discount: string;
  quantity: string;
  /** From API: purchasable variant lines (embedded or hierarchy-resolved). */
  variants?: ProductVariantRow[];
  gstRate?: number;
  /** Present on API payloads; used for catalog-line dedupe on server / similar products. */
  hierarchyCode?: string;
  /** Raw catalog image fields — used for master-sheet error logs when the image fails to load. */
  imageCatalog?: Pick<ProductLikeImageInput, 'thumbnailUrl' | 'cardImageUrl' | 'imageUrl' | 'images'>;
}

interface ProductCardProps {
  product: Product;
  onQuantityPress?: (productId: string) => void;
  onAddPress?: (productId: string) => void;
  onCardPress?: (productId: string) => void; // New prop for opening variant modal
  width?: number; // Optional width prop for responsive design
  selectedVariantId?: string; // Currently selected variant ID for this product
  /** When omitted, uses `product.variants` from the API. */
  variants?: ProductVariantRow[];
  imagePriority?: CmsImagePriority;
}

export default function ProductCard({
  product,
  onQuantityPress,
  onAddPress,
  onCardPress,
  width,
  selectedVariantId,
  variants: variantsProp,
  imagePriority = 'normal',
}: ProductCardProps) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { getLineQuantity, updateQuantity, cartItems, addToCart } = useCart();

  const variantRows = useMemo(() => {
    if (variantsProp && variantsProp.length > 0) {
      return variantsProp.map((v) => ({
        id: v.id,
        productId: v.productId ?? product.id,
        size: v.size,
        price: v.price,
        originalPrice: v.originalPrice,
      }));
    }
    return variantRowsFromApiProduct(product);
  }, [variantsProp, product]);

  const cartState = useMemo(
    () =>
      resolveProductCartLine(
        cartItems,
        product.id,
        variantRows,
        selectedVariantId,
      ),
    [cartItems, product.id, variantRows, selectedVariantId],
  );

  const activeVariantId = cartState.activeVariantId;
  const selectedVariant = variantRows.find((v) => v.id === activeVariantId) || variantRows[0];
  const variantSize = selectedVariant?.size || product.quantity || '1 unit';

  const displayPrice = selectedVariant?.price ?? product.price;
  const displayOriginal = selectedVariant?.originalPrice ?? product.originalPrice;

  const cartQuantity = cartState.quantity;
  const hasQuantity = cartQuantity > 0;
  const { productId: lineProductId, variantId: lineVariantId } = cartState;

  // Calculate proportional sizes based on width
  // Original: maxWidth 126.5, so we'll use that as base for calculations
  const baseWidth = 126.5;
  const scaleFactor = width ? width / baseWidth : 1;

  // Calculate proportional heights and sizes
  // Figma: Image band = 111px, quantity row = 28px, total top block = 139px — all scale together so
  // image + selector always fit imageContainer (no mismatch vs fixed 28px row).
  const quantityRowHeight = 28 * scaleFactor;
  const imageWrapperHeight = 111 * scaleFactor;
  const imageHeight = imageWrapperHeight + quantityRowHeight;
  const addButtonWidth = 127 * scaleFactor;
  const handleQuantityPress = useCallback(() => {
    // Always open modal/dropdown when clicking quantity selector
    if (onCardPress) {
      onCardPress(product.id); // Open ProductVariantModal
    } else if (onQuantityPress) {
      onQuantityPress(product.id); // Fallback handler
    } else {
      logger.info('Quantity selector pressed for product', { productId: product.id });
    }
  }, [product.id, onCardPress, onQuantityPress]);

  const handleProductPress = useCallback(() => {
    // Navigate to product detail page when clicking product card
    navigation.navigate('ProductDetail', { productId: product.id });
  }, [navigation, product.id]);

  const handleAddPress = useCallback(() => {
    if (activeVariantId && variantRows.length > 0) {
      const sel = variantRows.find((v) => v.id === activeVariantId) || variantRows[0];
      if (sel) {
        addOrIncrementCartLine(addToCart, updateQuantity, getLineQuantity, {
          ...buildCartItemPayload(product.id, product.name, sel, product),
        });
      }
    } else if (onAddPress) {
      onAddPress(product.id);
    } else {
      logger.info('Add to cart', { productId: product.id });
    }
  }, [activeVariantId, variantRows, getLineQuantity, addToCart, updateQuantity, product, onAddPress]);

  const handleAddButtonDecrease = useCallback((e: any) => {
    e?.stopPropagation?.();
    if (cartQuantity > 0) {
      updateQuantity(lineProductId, lineVariantId, cartQuantity - 1);
    }
  }, [lineProductId, lineVariantId, cartQuantity, updateQuantity]);

  const handleAddButtonIncrease = useCallback((e: any) => {
    e?.stopPropagation?.();
    if (cartQuantity >= 0) {
      updateQuantity(lineProductId, lineVariantId, cartQuantity + 1);
    }
  }, [lineProductId, lineVariantId, cartQuantity, updateQuantity]);

  const productImageCandidates = useMemo(
    () =>
      collectProductImageUrlCandidates({
        id: product.id,
        name: product.name,
        ...product.imageCatalog,
      }),
    [product.id, product.name, product.imageCatalog],
  );
  const productImageUri =
    productImageCandidates[0] ?? remoteDisplayUri(product.image) ?? '';
  const imageFit = getImageFitFromUrl(productImageUri);

  return (
    <View style={[styles.container, width ? { width, maxWidth: width } : null]}>
      {/* Product Image Container - Fixed 139px height from Figma (scaled when width prop set) */}
      <View
        style={[
          styles.imageContainer,
          { height: imageHeight, maxHeight: imageHeight },
        ]}
      >
        {/* Contain = full product visible in band; may letterbox (grey) if aspect ratio differs from slot. */}
        <View
          style={[
            styles.imageWrapper,
            {
              height: imageWrapperHeight,
              maxHeight: imageWrapperHeight,
            },
          ]}
        >
          <Pressable
            onPress={handleProductPress}
            style={StyleSheet.absoluteFillObject}
            accessibilityRole="button"
            accessibilityLabel={`${product.name}, view details`}
          >
            <View style={styles.imageClip}>
              {productImageUri ? (
                <CmsRemoteImage
                  uri={productImageUri}
                  uriCandidates={productImageCandidates}
                  style={styles.productImage}
                  contentFit={imageFit}
                  contentPosition="center"
                  transition={100}
                  priority={imagePriority}
                  recyclingKey={`product-${product.id}`}
                  imageMasterSheetContext={{
                    id: product.id,
                    name: product.name,
                    ...product.imageCatalog,
                  }}
                />
              ) : (
                <ExpoImage
                  source={product.image as any}
                  style={styles.productImage}
                  contentFit={imageFit}
                  contentPosition="center"
                  cachePolicy="disk"
                  transition={100}
                  onError={() => {
                    logger.error('Product card fallback image failed', {
                      productId: product.id,
                      name: product.name,
                    });
                  }}
                />
              )}
            </View>
          </Pressable>
        </View>
        {/* Quantity Selector - Always shows variant size with dropdown (quantity selection only) */}
        <TouchableOpacity
          style={[
            styles.quantityContainer,
            { height: quantityRowHeight, maxHeight: quantityRowHeight, minHeight: quantityRowHeight },
          ]}
          onPress={handleQuantityPress}
          activeOpacity={0.7}
        >
          <View style={styles.quantityTextContainer}>
            <Text
              style={styles.quantityText}
              numberOfLines={1}
            >
              {variantSize}
            </Text>
          </View>
          <View style={styles.dropdownIconContainer}>
            <DropdownArrowIcon />
          </View>
        </TouchableOpacity>
      </View>

      {/* Product Info Container - Card tap opens product details */}
      <TouchableOpacity style={styles.infoContainer} onPress={handleProductPress} activeOpacity={0.9}>
        {/* Product Name */}
        <View style={styles.nameContainer}>
          <Text style={styles.productName} numberOfLines={1}>
            {product.name}
          </Text>
        </View>

        {/* Discount and Price Container */}
        <View style={styles.priceDiscountContainer}>
          {/* Discount Badge */}
          <View style={styles.discountContainer}>
            <Text style={styles.discountText}>{product.discount}</Text>
          </View>

          {/* Price Row */}
          <View style={styles.priceRow}>
            {/* Current Price */}
            <View style={styles.currentPriceContainer}>
              <View style={styles.rupeeIconContainer}>
                <RupeeIcon size={10} color="#222222" />
              </View>
              <View style={styles.priceTextContainer}>
                <Text style={styles.currentPrice}>{displayPrice}</Text>
              </View>
            </View>

            {/* Original Price with Strikethrough */}
            <View style={styles.originalPriceContainer}>
              <View style={styles.originalPriceContent}>
                <View style={styles.originalPriceRupeeContainer}>
                  <RupeeIcon size={6} color="#777777" />
                </View>
                <View style={styles.originalPriceTextContainer}>
                  <Text style={styles.originalPrice}>{displayOriginal}</Text>
                  <View style={styles.strikethroughLine} />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Add Button or Quantity Selector - ONLY Add Button Section */}
        {hasQuantity ? (
          <View style={[styles.addButton, styles.addButtonQuantityLayout, width ? { width: addButtonWidth } : null]}>
            <TouchableOpacity
              style={styles.addButtonQuantityButton}
              onPress={handleAddButtonDecrease}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MinusIcon width={20} height={20} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.addButtonQuantityDisplay}>
              <Text style={styles.addButtonQuantityText} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.8}>
                {String(cartQuantity)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addButtonQuantityButton}
              onPress={handleAddButtonIncrease}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <PlusIcon width={20} height={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.addButton,
              styles.addButtonCentered,
              width ? { width: addButtonWidth } : null,
            ]}
            onPress={handleAddPress}
            activeOpacity={0.8}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 126.5,
    gap: 4,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    flexDirection: 'column',
    flexGrow: 0,
    flexShrink: 0,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  imageWrapper: {
    width: '100%',
    position: 'relative',
    flexShrink: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    overflow: 'hidden',
  },
  /** Image fills the band; overflow clipped (cover fit). */
  imageClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  quantityContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    flexShrink: 0,
    backgroundColor: '#F6FBF6',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(3, 71, 3, 0.2)',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingVertical: 0,
    paddingHorizontal: 8,
    gap: 4,
  },
  quantityControlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: 28,
    backgroundColor: '#F6FBF6',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(3, 71, 3, 0.2)',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
    flexShrink: 0,
  },
  quantityControlButton: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    // Match modal button style
  },
  quantityDisplayContainer: {
    flex: 1,
    minWidth: 20,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityDisplayText: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    color: '#034703',
    textAlign: 'center',
    includeFontPadding: false,
  },
  quantityTextContainer: {
    width: 48.69, // Fixed width from Figma
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    color: '#4C4C4C',
    textAlign: 'center',
    includeFontPadding: false,
  },
  dropdownIconContainer: {
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    gap: 8,
  },
  nameContainer: {
    gap: 10,
  },
  productName: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    color: '#525252',
  },
  priceDiscountContainer: {
    height: 41.3,
    gap: 0,
  },
  discountContainer: {
    marginBottom: 4,
  },
  discountText: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    color: '#FF8C00',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 4,
    paddingHorizontal: 0,
    minWidth: 0,
  },
  currentPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 21,
    gap: 2,
    flexShrink: 0,
  },
  rupeeIconContainer: {
    width: 10,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  priceTextContainer: {
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  currentPrice: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    color: '#1A1A1A',
    flexShrink: 0,
  },
  originalPriceContainer: {
    flexShrink: 0,
    minHeight: 16,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: 2,
  },
  originalPriceContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  originalPriceRupeeContainer: {
    width: 6,
    height: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
  },
  originalPriceTextContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  originalPrice: {
    fontFamily: 'Inter',
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 16,
    color: '#6B6B6B',
  },
  strikethroughLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 0.5,
    backgroundColor: '#777777',
  },
  addButton: {
    width: 127,
    backgroundColor: '#3B693E',
    borderWidth: 1,
    borderColor: '#012D01',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    // Shadow effect matching Figma (inset shadow)
    shadowColor: '#011501',
    shadowOffset: {
      width: 2,
      height: 2,
    },
    shadowOpacity: 0.31,
    shadowRadius: 3,
    elevation: 0,
  },
  addButtonCentered: {
    justifyContent: 'center',
  },
  addButtonQuantityLayout: {
    justifyContent: 'space-between',
  },
  addButtonText: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  addButtonQuantityButton: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  addButtonQuantityDisplay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 10,
  },
  addButtonQuantityText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

