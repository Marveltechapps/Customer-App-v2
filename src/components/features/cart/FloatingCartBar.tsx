import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackNavigationProp } from '@/types/navigation';
import Text from '../../common/Text';
import CmsRemoteImage from '../../common/CmsRemoteImage';
import { useCart } from '@/contexts/CartContext';
import ChevronRightIcon from '../../icons/ChevronRightIcon';
import { getImageFitFromUrl, resolveCartLineImageUrl } from '@/utils/productImage';

interface FloatingCartBarProps {
  onPress?: () => void;
  hasBottomNav?: boolean;
}

export default function FloatingCartBar({ onPress, hasBottomNav = false }: FloatingCartBarProps) {
  const { cartItems, getTotalItems } = useCart();
  const navigation = useNavigation<RootStackNavigationProp>();
  const totalItems = getTotalItems();
  const insets = useSafeAreaInsets();

  // Entrance animation
  const slideAnim = useRef(new Animated.Value(100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  /** Tab screens (Home, etc.): sit closer to the bottom nav. Other screens: slightly more breathing room. */
  const bottomGap = hasBottomNav ? 2 : 10;
  const bottomPosition = insets.bottom + bottomGap;

  // Entrance animation when cart has items
  useEffect(() => {
    if (totalItems > 0) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset when cart is empty
      slideAnim.setValue(100);
      opacityAnim.setValue(0);
    }
  }, [totalItems]);

  // Don't show if cart is empty
  if (totalItems === 0) {
    return null;
  }

  // Get latest 3 products (most recently added)
  // Last items in array are most recently added
  // Take the last 3 items from the array
  const latestItems = cartItems.slice(-3);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Navigate to Cart tab in MainTabs
      // If we're already in MainTabs, this will switch to Cart tab
      // If we're in a different stack, we need to navigate to MainTabs first
      try {
        navigation.navigate('Cart' as any);
      } catch (error) {
        // Fallback to Checkout if Cart navigation fails
        navigation.navigate('Checkout');
      }
    }
  };

  return (
    <Animated.View 
      style={[
        styles.wrapper, 
        { 
          bottom: bottomPosition,
          opacity: opacityAnim,
          transform: [{ translateY: slideAnim }],
        }
      ]}
    >
      <TouchableOpacity
        style={styles.container}
        onPress={handlePress}
        activeOpacity={0.8}
      >
      {/* Product Images - Show latest 3 */}
      <View style={styles.imagesContainer}>
        {latestItems.map((item, index) => {
          const imageUri = resolveCartLineImageUrl({
            productId: item.productId,
            productName: item.productName,
            image: item.image,
          });
          const imageFit = getImageFitFromUrl(imageUri);
          return (
            <View
              key={`${item.variantId}-${index}`}
              style={[
                styles.imageWrapper,
                index > 0 && styles.overlappingImage,
              ]}
            >
              <CmsRemoteImage
                uri={imageUri}
                style={styles.productImage}
                contentFit={imageFit}
                contentPosition="center"
                recyclingKey={`floating-cart-${item.variantId}`}
              />
            </View>
          );
        })}
      </View>

      {/* Text Container */}
      <View style={styles.textContainer}>
        <Text style={styles.viewCartText}>View Cart</Text>
        <Text style={styles.itemCountText}>{totalItems} Item{totalItems !== 1 ? 's' : ''}</Text>
      </View>

      {/* Arrow/Icon Container */}
      <View style={styles.iconContainer}>
        <ChevronRightIcon width={24} height={24} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center', // Center align
    zIndex: 1000,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    padding: 4,
    backgroundColor: '#3F723F',
    borderRadius: 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 10,
    maxWidth: 242, // Max width 242px
  },
  imagesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: -36, // Negative gap for overlapping effect
  },
  imageWrapper: {
    width: 48,
    height: 48,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3F723F',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlappingImage: {
    marginLeft: -36, // Overlap by 36px
  },
  productImage: {
    width: '100%',
    height: 49,
    borderRadius: 50,
  },
  textContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    width: 81.11,
    height: 44,
    gap: 0,
  },
  viewCartText: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  itemCountText: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 16,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 56,
    backgroundColor: '#618A66',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 5,
  },
});

