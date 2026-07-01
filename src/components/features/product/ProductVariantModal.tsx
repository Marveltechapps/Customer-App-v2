import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  ImageSourcePropType,
  Animated,
  Dimensions,
  Easing,
  ScrollView,
  ImageURISource,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '../../common/Text';
import RupeeIcon from '../../icons/RupeeIcon';
import CloseIcon from '../../icons/CloseIcon';
import PlusIcon from '../../icons/PlusIcon';
import MinusIcon from '../../icons/MinusIcon';
import { useCart } from '@/contexts/CartContext';
import { logger } from '@/utils/logger';
import { addOrIncrementCartLine } from '@/utils/cartActions';

export interface ProductVariant {
  id: string;
  size: string; // e.g., "500 g", "1 kg", "2 kg"
  image: ImageSourcePropType;
  price: number;
  originalPrice: number;
  discount: string; // e.g., "16% OFF"
  quantity?: number; // Current quantity in cart (0 if not in cart)
  /** Cart line product id (parent style id for embedded variants; SKU doc id for hierarchy). */
  productId?: string;
}

export interface ProductVariantModalProps {
  visible: boolean;
  productName: string;
  productId: string; // Add productId for cart integration
  variants: ProductVariant[];
  /** Applied to cart lines when variant row has no `productId`. */
  gstRate?: number;
  onClose: () => void;
  /** Called after the close animation finishes (safe to unmount). */
  onAfterClose?: () => void;
  onVariantSelect?: (variantId: string) => void;
  onAddToCart?: (variantId: string) => void;
  onQuantityChange?: (variantId: string, quantity: number) => void;
  fetchVariants?: () => Promise<ProductVariant[]>;
}

export default function ProductVariantModal({
  visible,
  productName = '',
  productId = '1',
  variants = [],
  gstRate = 0,
  onClose,
  onAfterClose,
  onVariantSelect,
  onAddToCart,
  onQuantityChange,
  fetchVariants,
}: ProductVariantModalProps) {
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  const insets = useSafeAreaInsets();
  const { addToCart, updateQuantity, getLineQuantity, cartItems } = useCart();
  const [variantList, setVariantList] = useState<ProductVariant[]>(variants);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const screenHeight = Dimensions.get('window').height;
  const slideAnim = React.useRef(new Animated.Value(screenHeight)).current;
  const backdropOpacity = React.useRef(new Animated.Value(0)).current;
  /** Keep RN Modal mounted until exit animation finishes — avoids close snapping when parent sets `visible={false}`. */
  const [sheetMounted, setSheetMounted] = useState(visible);
  const sheetPresentRef = React.useRef(visible);
  const fetchVariantsRef = React.useRef(fetchVariants);
  const lastFetchedProductIdRef = React.useRef<string | null>(null);
  const didInitialFetchRef = React.useRef(false);
  const fetchSeqRef = React.useRef(0);

  const lineProductIdForVariant = React.useCallback(
    (variant: Pick<ProductVariant, 'id' | 'productId'>) =>
      String(variant.productId ?? productId).trim(),
    [productId],
  );

  const getVariantLineQuantity = React.useCallback(
    (variant: Pick<ProductVariant, 'id' | 'productId'>) =>
      getLineQuantity(lineProductIdForVariant(variant), variant.id),
    [getLineQuantity, lineProductIdForVariant],
  );
  
  // Track quantities for each variant - sync with cart
  const [variantQuantities, setVariantQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    const finalVariants = variants && variants.length > 0 ? variants : [];
    finalVariants.forEach((v) => {
      initial[v.id] = getVariantLineQuantity(v);
    });
    return initial;
  });

  // Sync quantities with cart when modal opens or cart changes
  useEffect(() => {
    if (visible && variantList.length > 0) {
      setVariantQuantities((prev) => {
        const updated: Record<string, number> = {};
        variantList.forEach((v) => {
          updated[v.id] = getVariantLineQuantity(v);
        });
        return updated;
      });
      
      setVariantList((prev) =>
        prev.map((v) => ({
          ...v,
          quantity: getVariantLineQuantity(v),
        })),
      );
    }
  }, [visible, cartItems, getVariantLineQuantity, variantList.length]);

  // Initialize from provided variants when we don't have a fetcher.
  useEffect(() => {
    if (!visible) {
      setSelectedVariantId(null);
      return;
    }
    const fn = fetchVariantsRef.current;
    if (fn) {
      return;
    }
    const finalVariants = variants && variants.length > 0 ? variants : [];
    setVariantList(finalVariants);
    if (finalVariants.length > 0) {
      setSelectedVariantId(finalVariants[0].id);
    }
    const initial: Record<string, number> = {};
    finalVariants.forEach((v) => {
      initial[v.id] = getVariantLineQuantity(v);
    });
    setVariantQuantities(initial);
  }, [visible, variants, getVariantLineQuantity]);

  // Keep latest fetch callback without re-triggering fetch effect.
  useEffect(() => {
    fetchVariantsRef.current = fetchVariants;
  }, [fetchVariants]);

  // Fetch variants only when opening the sheet (or switching productId while open).
  // Avoid "loading" flashes on every cart interaction by NOT depending on fetchVariants identity.
  useEffect(() => {
    if (!visible) {
      return;
    }
    const fn = fetchVariantsRef.current;
    if (!fn) {
      return;
    }

    const shouldFetch =
      !didInitialFetchRef.current ||
      lastFetchedProductIdRef.current == null ||
      lastFetchedProductIdRef.current !== productId;
    if (!shouldFetch) {
      return;
    }

    const seq = ++fetchSeqRef.current;
    didInitialFetchRef.current = true;
    lastFetchedProductIdRef.current = productId;

    const showBlockingLoading = variantList.length === 0;
    if (showBlockingLoading) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }

    (async () => {
      try {
        const data = await fn();
        // Ignore stale results (e.g., rapid product changes / close during fetch).
        if (fetchSeqRef.current !== seq || !sheetPresentRef.current) {
          return;
        }
        setVariantList(data && data.length > 0 ? data : []);
      } catch (error) {
        logger.error('Error fetching variants', error);
        if (fetchSeqRef.current !== seq || !sheetPresentRef.current) {
          return;
        }
        // Keep existing list on refresh failure; only clear if we had nothing.
        if (variantList.length === 0) {
          setVariantList([]);
        }
      } finally {
        if (fetchSeqRef.current !== seq || !sheetPresentRef.current) {
          return;
        }
        setLoading(false);
        setIsRefreshing(false);
      }
    })();
  }, [visible, productId, variantList.length]);

  // Open / close: use easing-based timing so close never "snaps".
  useEffect(() => {
    const h = Dimensions.get('window').height;
    const ease = Easing.bezier(0.16, 1, 0.3, 1);
    const backdropTarget = 0.5;
    const openDurationMs = 360;
    const closeDurationMs = 420;

    if (visible) {
      sheetPresentRef.current = true;
      setSheetMounted(true);
      slideAnim.setValue(h);
      backdropOpacity.setValue(0);
      const frame = requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: openDurationMs,
            easing: ease,
            useNativeDriver: true,
          }),
          Animated.timing(backdropOpacity, {
            toValue: backdropTarget,
            duration: openDurationMs,
            easing: ease,
            useNativeDriver: true,
          }),
        ]).start();
      });
      return () => cancelAnimationFrame(frame);
    }

    if (!sheetPresentRef.current) {
      return;
    }
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: h,
        duration: closeDurationMs,
        easing: ease,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: closeDurationMs,
        easing: ease,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        sheetPresentRef.current = false;
        setSheetMounted(false);
        onAfterClose?.();
      }
    });
  }, [visible, slideAnim, backdropOpacity]);

  const handleVariantSelect = (variantId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    // Only one card can be selected at once
    setSelectedVariantId(variantId);
    if (onVariantSelect) {
      onVariantSelect(variantId);
    }
  };
  
  // Sync selected variant from props or cart
  useEffect(() => {
    if (visible && variantList.length > 0) {
      // Check if any variant is in cart and select it
      const variantInCart = variantList.find((v) => getVariantLineQuantity(v) > 0);
      if (variantInCart) {
        setSelectedVariantId(variantInCart.id);
      } else if (variantList.length > 0) {
        // Default to first variant if none in cart
        setSelectedVariantId(variantList[0].id);
      }
    }
  }, [visible, variantList, getVariantLineQuantity]);

  const handleAddToCart = (variantId: string) => {
    const variant = variantList.find((v) => v.id === variantId);
    if (!variant) return;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    const lineProductId = lineProductIdForVariant(variant);
    const nextQty = Math.min(10, getLineQuantity(lineProductId, variantId) + 1);
    setVariantQuantities((prev) => ({
      ...prev,
      [variantId]: nextQty,
    }));
    setVariantList((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, quantity: nextQty } : v)),
    );

    addOrIncrementCartLine(addToCart, updateQuantity, getLineQuantity, {
      productId: lineProductId,
      productName,
      variantId: variant.id,
      variantSize: variant.size,
      image: variant.image,
      price: variant.price,
      originalPrice: variant.originalPrice,
      discount: variant.discount,
      gstRate,
    });

    if (onAddToCart) {
      onAddToCart(variantId);
    }
  };

  const handleQuantityChange = (variantId: string, newQuantity: number) => {
    const variant = variantList.find((v) => v.id === variantId);
    if (!variant) return;

    const safeQuantity = Math.max(0, newQuantity);
    const lineProductId = lineProductIdForVariant(variant);
    
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    updateQuantity(lineProductId, variantId, safeQuantity);

    // Update local quantity state
    setVariantQuantities((prev) => ({
      ...prev,
      [variantId]: safeQuantity,
    }));

    if (onQuantityChange) {
      onQuantityChange(variantId, safeQuantity);
    }

    // Update local variant list
    setVariantList((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, quantity: safeQuantity } : v))
    );
  };

  // Calculate total price based on selected quantities
  const calculateTotalPrice = (): number => {
    return variantList.reduce((total, variant) => {
      const quantity = variantQuantities[variant.id] || 0;
      return total + variant.price * quantity;
    }, 0);
  };

  const totalPrice = calculateTotalPrice();

  return (
    <Modal
      visible={sheetMounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        </TouchableWithoutFeedback>

        {/* Modal content */}
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.productName}>{productName}</Text>
              <Text style={styles.subtitle}>Select size & quantity</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <CloseIcon width={24} height={24} color="#4C4C4C" />
            </TouchableOpacity>
          </View>

          {/* Preload all images (hidden) - ensures all images load immediately */}
          <View style={styles.imagePreloadContainer}>
            {variantList && variantList.length > 0 && variantList.map((variant, index) => (
              <Image
                key={`preload-${variant.id}-${index}`}
                source={variant.image}
                style={styles.preloadImage}
              />
            ))}
          </View>

          {/* Variants List */}
          <ScrollView
            style={styles.variantsList}
            contentContainerStyle={styles.variantsListContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            bounces={false}
            removeClippedSubviews={false} // Disable lazy loading to ensure all images render
          >
            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="large" color="#3F723F" />
              </View>
            ) : variantList && variantList.length > 0 ? (
              variantList.map((variant, index) => {
                const currentQuantity = variantQuantities[variant.id] || 0;
                return (
                  <VariantCard
                    key={`variant-${variant.id}-${index}`}
                    variant={variant}
                    quantity={currentQuantity}
                    isLastVariant={index === variantList.length - 1}
                    isSelected={selectedVariantId === variant.id}
                    onSelect={() => handleVariantSelect(variant.id)}
                    onAdd={() => handleAddToCart(variant.id)}
                    onQuantityChange={(newQuantity) =>
                      handleQuantityChange(variant.id, newQuantity)
                    }
                  />
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No variants available</Text>
              </View>
            )}
          </ScrollView>

          {/* Total Price Display */}
          {totalPrice > 0 && (
            <View
              style={[
                styles.totalPriceContainer,
                { paddingBottom: Math.max(16, 16 + (insets?.bottom ?? 0)) },
              ]}
            >
              <View style={styles.totalPriceContent}>
                <Text style={styles.totalPriceLabel}>Total:</Text>
                <View style={styles.totalPriceValue}>
                  <RupeeIcon size={16} color="#1A1A1A" />
                  <Text style={styles.totalPriceText}>{totalPrice.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// Variant Card Component
interface VariantCardProps {
  variant: ProductVariant;
  quantity?: number;
  isLastVariant?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onAdd?: () => void;
  onQuantityChange?: (quantity: number) => void;
}

function VariantCard({ variant, quantity = 0, isLastVariant = false, isSelected = false, onSelect, onAdd, onQuantityChange }: VariantCardProps) {
  // Use quantity prop instead of variant.quantity
  const hasQuantity = quantity > 0;

  const handleCardPress = () => {
    // When card is pressed, select it
    if (onSelect) {
      onSelect();
    }
  };

  const handleAddPress = (e?: any) => {
    // Stop event propagation to prevent any parent handlers
    if (e) {
      e.stopPropagation?.();
    }
    // When Add is pressed, add to cart (set quantity to 1)
    if (onAdd) {
      onAdd();
    }
  };

  const handleDecrease = () => {
    if (quantity > 0) {
      // Decrease quantity by 1, allowing it to go to 0
      // When quantity becomes 0, item will be removed from cart and "Add" button will show
      const newQuantity = quantity - 1;
      if (onQuantityChange) {
        onQuantityChange(newQuantity);
      }
    }
  };

  const handleIncrease = () => {
    const newQuantity = quantity + 1;
    if (onQuantityChange) {
      onQuantityChange(newQuantity);
    }
  };

  return (
    <View style={styles.variantCard}>
      {/* Product Image */}
      <View style={styles.imageContainer}>
        <Image
          source={variant.image}
          style={styles.variantImage}
          resizeMode="cover"
          // Force image to load immediately
          defaultSource={typeof variant.image === 'number' ? variant.image : undefined}
          onError={() => {
            const uri =
              typeof variant.image === 'object' && variant.image != null && !Array.isArray(variant.image) && 'uri' in variant.image
                ? (variant.image as ImageURISource).uri
                : undefined;
            logger.error('Variant image failed to load', {
              variantId: variant.id,
              productId: variant.productId,
              uri: uri ?? 'local-asset',
            });
          }}
        />
      </View>

      {/* Variant Info */}
      <View style={styles.variantInfo}>
        {/* Size Label */}
        <Text style={styles.sizeLabel}>
          {variant.size}
        </Text>

        {/* Price Info */}
        <View style={styles.priceContainer}>
          <View style={styles.priceRow}>
            <View style={styles.currentPriceContainer}>
              <RupeeIcon size={10} color="#1A1A1A" />
              <Text style={styles.currentPrice}>
                {variant.price}
              </Text>
            </View>
            <View style={styles.originalPriceContainer}>
              <RupeeIcon size={6} color="#6B6B6B" />
              <Text style={styles.originalPrice}>
                {variant.originalPrice}
              </Text>
            </View>
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{variant.discount}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Add Button or Quantity Selector */}
      {hasQuantity ? (
        <View style={styles.quantitySelector}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={handleDecrease}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MinusIcon width={16} height={16} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.quantityDisplay}>
            <Text style={styles.quantityText} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.8}>
              {String(quantity)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={handleIncrease}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <PlusIcon width={16} height={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.addButton}
          onPress={(e) => {
            e?.stopPropagation?.();
            handleAddPress(e);
          }}
          activeOpacity={0.8}
          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
        >
          <Text style={styles.addButtonText}>
            Add
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: Dimensions.get('window').height * 0.85,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -12, // Match Figma: 0px 25px 50px -12px
    },
    shadowOpacity: 0.25, // Match Figma: rgba(0, 0, 0, 0.25)
    shadowRadius: 50, // Match Figma: 50px blur
    elevation: 25,
    flexDirection: 'column',
    alignSelf: 'flex-end',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(209, 209, 209, 0.3)',
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    gap: 8,
  },
  headerContent: {
    flex: 1,
    gap: 0,
  },
  productName: {
    fontFamily: 'Inter',
    fontWeight: '600',
    fontSize: 20,
    lineHeight: 28, // 1.4em
    color: '#1A1A1A',
    marginBottom: 0,
  },
  subtitle: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18, // 1.5em
    color: '#4C4C4C',
    marginTop: 0,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  variantsList: {
    flexGrow: 0,
    flexShrink: 1,
  },
  variantsListContent: {
    padding: 16,
    gap: 8,
    paddingBottom: 32,
    minHeight: 200, // Ensure minimum height for content
  },
  loadingState: {
    paddingVertical: 48,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: '#6B6B6B',
  },
  imagePreloadContainer: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
    zIndex: -1,
  },
  preloadImage: {
    width: 1,
    height: 1,
  },
  variantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2, // Match Figma: strokeWeight: 2px
    borderColor: '#F1F1F1',
    borderRadius: 8,
  },
  imageContainer: {
    width: 56,
    height: 56,
    backgroundColor: '#EDEDED',
    borderRadius: 8,
    overflow: 'hidden',
  },
  variantImage: {
    width: '100%',
    height: '100%',
  },
  variantInfo: {
    flex: 1,
    gap: 4,
  },
  sizeLabel: {
    fontFamily: 'Inter',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20, // 1.4285714285714286em
    color: '#4C4C4C',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currentPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  currentPrice: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20, // 1.4285714285714286em
    color: '#1A1A1A',
  },
  originalPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  originalPrice: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 16, // 1.3333333333333333em
    color: '#6B6B6B',
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    backgroundColor: 'rgba(255, 140, 0, 0.2)',
    borderRadius: 3.5,
    paddingHorizontal: 6,
    paddingVertical: 0,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 54,
  },
  discountText: {
    fontFamily: 'Inter',
    fontWeight: '600',
    fontSize: 10,
    lineHeight: 14, // 1.4em
    color: '#FF8C00',
  },
  addButton: {
    width: 102,
    minHeight: 36,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Match Figma: fill_VAYCYJ
    borderColor: '#034703', // Match Figma: stroke_5T7FAG
    borderWidth: 1,
  },
  addButtonText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20, // 1.4285714285714286em
    color: '#034703', // Match Figma: fill_4UYMCR
  },
  quantitySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    minWidth: 102,
    minHeight: 36,
    backgroundColor: '#3F723F', // Match Figma: fill_Q5KA8O
    borderWidth: 1,
    borderColor: '#023302', // Match Figma: stroke_EOX080
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    // Note: React Native doesn't support inset shadows directly
    // Figma has: inset 2px 2px 3px 0px rgba(1, 21, 1, 0.31)
    // Using regular shadow as fallback
    shadowColor: '#011501',
    shadowOffset: {
      width: 2,
      height: 2,
    },
    shadowOpacity: 0.31,
    shadowRadius: 3,
    elevation: 0,
  },
  quantityButton: {
    width: 15, // Increased by 50% from 10
    minHeight: 20, // Increased by 50% from 20
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  quantityButtonText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 16, // Decreased by another 25% from 23.625 (23.625 * 0.75)
    lineHeight: 20, // Decreased by another 25% from 33.75 (33.75 * 0.75)
    color: '#FFFFFF',
    textAlign: 'center',
    includeFontPadding: false,
  },
  quantityDisplay: {
    minWidth: 24,
    minHeight: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    paddingHorizontal: 6,
  },
  quantityText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20, // 1.4285714285714286em
    color: '#FFFFFF',
    textAlign: 'center',
    includeFontPadding: false,
  },
  totalPriceContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(209, 209, 209, 0.3)',
    backgroundColor: '#FFFFFF',
  },
  totalPriceContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalPriceLabel: {
    fontFamily: 'Inter',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 24,
    color: '#1A1A1A',
  },
  totalPriceValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  totalPriceText: {
    fontFamily: 'Inter',
    fontWeight: '600',
    fontSize: 18,
    lineHeight: 24,
    color: '#1A1A1A',
  },
});

