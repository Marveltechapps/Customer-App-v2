import React, { useMemo, useCallback } from 'react';
import { variantRowsFromApiProduct, type ProductVariantRow } from '@/utils/productVariants';
import { View, StyleSheet, Image, TouchableOpacity, ImageSourcePropType } from 'react-native';
import Text from '../../common/Text';
import RupeeIcon from '../../icons/RupeeIcon';
import DropdownArrowIcon from '../../icons/DropdownArrowIcon';
import PlusIcon from '../../icons/PlusIcon';
import MinusIcon from '../../icons/MinusIcon';
import { useCart } from '@/contexts/CartContext';
import { useDimensions, scale, scaleFont, getSpacing, getCardWidth } from '@/utils/responsive';
import { logger } from '@/utils/logger';
import { addOrIncrementCartLine } from '@/utils/cartActions';
import {
  buildCartItemPayload,
  resolveProductCartLine,
} from '@/utils/productCardCart';

export interface BannerProduct {
  id: string;
  name: string;
  image: ImageSourcePropType;
  price: number;
  originalPrice: number;
  discount: string;
  quantity: string;
  variants?: ProductVariantRow[];
  gstRate?: number;
}

interface BannerProductCardProps {
  product: BannerProduct;
  onQuantityPress?: (productId: string) => void;
  onAddPress?: (productId: string) => void;
  onCardPress?: (productId: string) => void; // New prop for opening variant modal
  width?: number; // Optional width prop for responsive design
  selectedVariantId?: string; // Currently selected variant ID for this product
  variants?: ProductVariantRow[];
  textColor?: 'default' | 'white'; // Text color variant - white for Bedtime Boosters section
}

export default function BannerProductCard({ 
  product, 
  onQuantityPress, 
  onAddPress, 
  onCardPress, 
  width,
  selectedVariantId,
  variants: variantsProp,
  textColor = 'default'
}: BannerProductCardProps) {
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

  const variants = variantRows;
  
  const { width: screenWidth } = useDimensions();
  
  // Use provided width or calculate default responsive width
  const responsiveCardWidth = useMemo(() => {
    if (width) return width;
    const containerPadding = getSpacing(16) * 2; // 16px on each side
    const gapBetweenCards = getSpacing(8); // 8px gap between cards
    return (screenWidth - containerPadding - gapBetweenCards) / 2;
  }, [width, screenWidth]);
  
  const cardWidth = responsiveCardWidth;

  const cartState = useMemo(
    () =>
      resolveProductCartLine(
        cartItems,
        product.id,
        variants,
        selectedVariantId,
      ),
    [cartItems, product.id, variants, selectedVariantId],
  );

  const activeVariantId = cartState.activeVariantId;
  const selectedVariant = variants.find((v) => v.id === activeVariantId) || variants[0];
  const variantSize = selectedVariant?.size || product.quantity || '1 unit';

  const cartQuantity = cartState.quantity;
  const hasQuantity = cartQuantity > 0;
  const { productId: lineProductId, variantId: lineVariantId } = cartState;

  const handleQuantityPress = useCallback(() => {
    // Always open modal when clicking quantity selector
    if (onCardPress) {
      onCardPress(product.id);
    } else if (onQuantityPress) {
      onQuantityPress(product.id);
    } else {
      logger.info('Quantity selector pressed for product', { productId: product.id });
    }
  }, [product.id, onCardPress, onQuantityPress]);

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

  const handleCardPress = useCallback(() => {
    if (onCardPress) {
      onCardPress(product.id);
    }
  }, [product.id, onCardPress]);

  return (
    <View style={[styles.container, width ? { width, maxWidth: width } : { width: cardWidth }]}>
      {/* Product Image Container */}
      <View style={styles.imageContainer}>
        {/* Image - Clickable to open modal */}
        <TouchableOpacity 
          style={styles.imageWrapper}
          onPress={handleCardPress}
          activeOpacity={0.9}
        >
          <Image source={product.image} style={styles.productImage} resizeMode="cover" />
        </TouchableOpacity>
        {/* Quantity Selector - Clickable Dropdown */}
        <TouchableOpacity 
          style={styles.quantityContainer} 
          onPress={handleQuantityPress}
          activeOpacity={0.7}
        >
          <View style={styles.quantityTextContainer}>
            <Text style={StyleSheet.flatten([styles.quantityText, textColor === 'white' && styles.quantityTextWhite])}>{variantSize}</Text>
          </View>
          <View style={styles.dropdownIconContainer}>
            <DropdownArrowIcon />
          </View>
        </TouchableOpacity>
      </View>

      {/* Product Info Container - Clickable to open modal */}
      <TouchableOpacity 
        style={styles.infoContainer}
        onPress={handleCardPress}
        activeOpacity={0.9}
      >
        {/* Product Name */}
        <View style={styles.nameContainer}>
          <Text style={StyleSheet.flatten([styles.productName, textColor === 'white' && styles.productNameWhite])} numberOfLines={1}>
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
                <RupeeIcon size={10} color={textColor === 'white' ? '#FFFFFF' : '#222222'} />
              </View>
              <View style={styles.priceTextContainer}>
                <Text style={StyleSheet.flatten([styles.currentPrice, textColor === 'white' && styles.currentPriceWhite])}>{product.price}</Text>
              </View>
            </View>

            {/* Original Price with Strikethrough */}
            <View style={styles.originalPriceContainer}>
              <View style={styles.originalPriceContent}>
                <View style={styles.originalPriceRupeeContainer}>
                  <RupeeIcon size={6} color={textColor === 'white' ? '#FFFFFF' : '#777777'} />
                </View>
                <View style={styles.originalPriceTextContainer}>
                  <Text style={StyleSheet.flatten([styles.originalPrice, textColor === 'white' && styles.originalPriceWhite])}>{product.originalPrice}</Text>
                  <View style={StyleSheet.flatten([styles.strikethroughLine, textColor === 'white' && styles.strikethroughLineWhite])} />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Add Button or Quantity Selector - Same as ProductCard */}
        {hasQuantity ? (
          <View style={[styles.addButton, styles.addButtonQuantityLayout, width ? { width } : { width: cardWidth }]}>
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
            style={[styles.addButton, styles.addButtonCentered, width ? { width } : { width: cardWidth }]} 
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
    gap: 8,
  },
  imageContainer: {
    width: '100%',
    height: scale(140),
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: scale(8),
  },
  imageWrapper: {
    height: scale(112), // Fixed height to leave space for quantity selector
    width: '100%',
    backgroundColor: '#EDEDED',
    borderTopLeftRadius: scale(8),
    borderTopRightRadius: scale(8),
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
    backgroundColor: '#F6FBF6',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(3, 71, 3, 0.2)',
    borderBottomLeftRadius: scale(8),
    borderBottomRightRadius: scale(8),
    gap: getSpacing(4),
    paddingVertical: getSpacing(4),
    paddingHorizontal: getSpacing(8),
    height: scale(28), // Fixed height to ensure visibility
    width: '100%',
    minHeight: scale(28)
  },
  quantityTextContainer: {
    flex: 1,
    minWidth: 48.69,
    height: 16,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 0,
  },
  quantityText: {
    fontFamily: 'Inter',
    fontSize: scaleFont(12, 10, 14),
    fontWeight: '500',
    lineHeight: scaleFont(16, 14, 18),
    color: '#1a1a1a',
    textAlign: 'center',
  },
  quantityTextWhite: {
    color: '1a1a1a',
  },
  productNameWhite: {
    color: '#FFFFFF',
  },
  currentPriceWhite: {
    color: '#FFFFFF',
  },
  originalPriceWhite: {
    color: '#FFFFFF',
  },
  strikethroughLineWhite: {
    backgroundColor: '#FFFFFF',
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
    fontSize: scaleFont(12, 10, 14),
    fontWeight: '500',
    lineHeight: scaleFont(18, 16, 20),
    color: '#525252',
  },
  priceDiscountContainer: {
    height: scale(41.3),
    gap: 0,
  },
  discountContainer: {
    marginBottom: 4,
  },
  discountText: {
    fontFamily: 'Inter',
    fontSize: scaleFont(12, 10, 14),
    fontWeight: '600',
    lineHeight: scaleFont(18, 16, 20),
    color: '#F9A825', // Orange color from Figma
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
    fontSize: scaleFont(14, 12, 16),
    fontWeight: '600',
    lineHeight: scaleFont(20, 18, 22),
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
    fontSize: scaleFont(10, 9, 12),
    fontWeight: '400',
    lineHeight: scaleFont(16, 14, 18),
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
    backgroundColor: '#3F723F',
    borderWidth: 1,
    borderColor: '#012D01',
    borderRadius: scale(4),
    paddingVertical: getSpacing(6),
    paddingHorizontal: getSpacing(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonCentered: {
    justifyContent: 'center',
  },
  addButtonQuantityLayout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  addButtonQuantityButton: {
    width: scale(20),
    height: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonQuantityDisplay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 30,
  },
  addButtonQuantityText: {
    fontFamily: 'Inter',
    fontSize: scaleFont(14, 12, 16),
    fontWeight: '500',
    lineHeight: scaleFont(20, 18, 22),
    color: '#FFFFFF',
    textAlign: 'center',
  },
  addButtonText: {
    fontFamily: 'Inter',
    fontSize: scaleFont(14, 12, 16),
    fontWeight: '500',
    lineHeight: scaleFont(20, 18, 22),
    color: '#FFFFFF',
  },
});
