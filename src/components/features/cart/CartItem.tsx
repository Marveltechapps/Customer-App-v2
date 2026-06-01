import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ImageSourcePropType } from 'react-native';
import CmsRemoteImage from '../../common/CmsRemoteImage';
import PlusIcon from '../../icons/PlusIcon';
import MinusIcon from '../../icons/MinusIcon';
import { getImageFitFromUrl, resolveCartLineImageUrl } from '@/utils/productImage';
import { useCart } from '@/contexts/CartContext';

export interface CartItemData {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  weight: string;
  quantity: number;
  discountedPrice: number;
  originalPrice: number;
  image?: string | any; // Can be string URI or ImageSourcePropType (require() result)
}

interface CartItemProps {
  item: CartItemData;
}

const CartItem: React.FC<CartItemProps> = ({ item }) => {
  const { updateQuantity, removeFromCart } = useCart();

  const handleIncrease = () => {
    updateQuantity(item.productId, item.variantId, item.quantity + 1);
  };

  const handleDecrease = () => {
    if (item.quantity > 1) {
      updateQuantity(item.productId, item.variantId, item.quantity - 1);
    } else {
      removeFromCart(item.productId, item.variantId);
    }
  };

  const imageUri = useMemo(
    () =>
      resolveCartLineImageUrl({
        productName: item.name,
        image: item.image,
      }),
    [item.image, item.name],
  );
  const imageFit = getImageFitFromUrl(imageUri);
  const discountedPrice = Number(item.discountedPrice);
  const originalPrice = Number(item.originalPrice);
  const safeDiscountedPrice = Number.isFinite(discountedPrice) ? discountedPrice : 0;
  const safeOriginalPrice = Number.isFinite(originalPrice) ? originalPrice : safeDiscountedPrice;

  const bundledImageSource = useMemo((): ImageSourcePropType | null => {
    if (!item.image || typeof item.image === 'string') return null;
    if (typeof item.image === 'number') return item.image;
    if (typeof item.image === 'object' && item.image !== null && !Array.isArray(item.image) && !('uri' in item.image)) {
      return item.image as ImageSourcePropType;
    }
    return null;
  }, [item.image]);

  return (
    <View style={styles.container}>
      <View style={styles.mainContent}>
        <View style={styles.imageContainer}>
          <View style={styles.imageGradient}>
            {bundledImageSource ? (
              <Image source={bundledImageSource} style={styles.image} resizeMode={imageFit} />
            ) : (
              <CmsRemoteImage
                uri={imageUri}
                style={styles.image}
                contentFit={imageFit}
                contentPosition="center"
                recyclingKey={`cart-line-${item.id}`}
              />
            )}
          </View>
        </View>
        
        <View style={styles.contentContainer}>
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{item.name}</Text>
            <Text style={styles.productWeight}>{item.weight}</Text>
          </View>
          
          <View style={styles.priceContainer}>
            <Text style={styles.discountedPrice}>₹{safeDiscountedPrice.toFixed(0)}</Text>
            <Text style={styles.originalPrice}>₹{safeOriginalPrice.toFixed(0)}</Text>
            {safeOriginalPrice > safeDiscountedPrice && safeOriginalPrice > 0 && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText} numberOfLines={1}>
                  {Math.round(((safeOriginalPrice - safeDiscountedPrice) / safeOriginalPrice) * 100)}% OFF
                </Text>
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.quantityContainer}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={handleDecrease}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MinusIcon width={20} height={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.quantityDisplay}>
            <Text style={styles.quantityText} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.8}>
              {String(item.quantity)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={handleIncrease}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <PlusIcon width={20} height={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 6, // Reduced by 50% (was 12)
    paddingHorizontal: 8, // Reduced by 50% (was 16)
    gap: 6, // Reduced by 50% (was 12)
    alignSelf: 'stretch',
  },
  mainContent: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 8,
    alignItems: 'center',
  },
  imageContainer: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
  },
  imageGradient: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E8F4F3', // Approximate gradient color (mix of rgba(224, 242, 241, 1) and rgba(245, 245, 245, 1))
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'column',
    gap: 0,
  },
  productInfo: {
    flexDirection: 'column',
    alignSelf: 'stretch',
    gap: 0,
    marginBottom: 0,
  },
  productName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1A1A1A',
    lineHeight: 18, // 1.5em
  },
  productWeight: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 16, // 1.333em
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 0,
  },
  discountedPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: '#034703',
    lineHeight: 20, // 1.4285714285714286em
  },
  originalPrice: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B6B6B',
    textDecorationLine: 'line-through',
    lineHeight: 16, // 1.333em
  },
  discountBadge: {
    backgroundColor: '#E0F2F1',
    borderRadius: 3.5,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  discountBadgeText: {
    fontSize: 10,
    fontWeight: '400',
    color: '#034703',
    lineHeight: 16, // 1.6em
    textAlign: 'center',
    flexShrink: 0,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    width: 110, // Increased from 88 for more width
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#034703', // Match "Continue to Payment" button color
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#012D01', // Match ProductCard addButton border color
    shadowColor: '#011501', // Match ProductCard addButton shadow color
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.31,
    shadowRadius: 3,
    elevation: 0, // Match ProductCard addButton elevation
    alignSelf: 'flex-start',
  },
  quantityButton: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  quantityDisplay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 10,
  },
  quantityText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

export default CartItem;

