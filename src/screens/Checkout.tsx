/**
 * Checkout Screen
 * 
 * Recreated to match Figma design node-id=12626-15711
 * Shows full checkout flow with address, tip, coupons, bill summary, delivery instructions
 * 
 * Features:
 * - Header with item count and Add More button
 * - View Coupons & Offers expandable section
 * - Cart items with discount badges
 * - Delivery Partner Tip with inline tip buttons
 * - Bill Summary with savings badge
 * - Delivery Instructions with toggle buttons
 * - Additional Instructions text input
 * - Bottom payment section with address
 * 
 * @format
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Image,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute, useIsFocused } from '@react-navigation/native';
import { useRefreshAppConfigOnFocus } from '../hooks/useRefreshAppConfigOnFocus';
import Header from '../components/layout/Header';
import CartItem, { CartItemData } from '../components/features/cart/CartItem';
import { logger } from '@/utils/logger';
import BillSummary, { BillSummaryData } from '../components/features/cart/BillSummary';
import DeliveryAddressCard from '../components/features/order/DeliveryAddressCard';
import { useCart, CartItem as CartContextItem } from '@/contexts/CartContext';
import { useAppConfig } from '../contexts/AppConfigContext';
import ShopIcon from '../components/icons/ShopIcon';
import ChevronDownIcon from '../assets/images/chevron-down.svg';
import ChevronUpIcon from '../assets/images/chevron-up.svg';
import MapPinIcon from '../assets/images/map-pin.svg';
import CouponIcon from '../assets/images/coupon-icon.svg';
import TipIcon from '../assets/images/tip-icon.svg';
import RupeeIcon from '../assets/images/rupee-sign.svg';
import NoContactDeliveryIcon from '../assets/images/no-contact-delivery-icon.svg';
import DontRingBellIcon from '../assets/images/dont-ring-bell-icon.svg';
import PetAtHomeIcon from '../assets/images/pet-at-home-icon.svg';
import { couponService, ValidateCouponResponse, Coupon } from '../services/coupons/couponService';
import { useLocation } from '../contexts/LocationContext';
import { useUser } from '../contexts/UserContext';
import { getApiErrorMessage } from '../services/api/types';
import { resolveCartLineImageUrl } from '../utils/productImage';
import * as cartApiService from '../services/cart/cartService';
import Toast from 'react-native-toast-message';
import PlusIcon from '../assets/images/plus.svg';
import { addressService, type Address } from '../services/address/addressService';
import type { RootStackNavigationProp } from '../types/navigation';
import { getToken } from '@/utils/storage';
import { tokenManager } from '../services/api/tokenManager';
import { updateProfile } from '../services/profile/profileService';
import userService from '../services/user/userService';
import { subscribeAddressesChanged } from '../utils/addressRefresh';

type PaymentMethodOption = 'wallet' | 'cash' | 'card' | 'upi';

/** Space reserved so last scroll content clears the absolute-positioned address + payment bar (not oversized). */
/** Extra scroll padding so the last card clears the Pay footer when keyboard is closed. */
const CHECKOUT_FOOTER_SCROLL_CLEARANCE = 180;

interface CheckoutScreenProps {
  initialCartItems?: CartItemData[];
  initialDeliveryAddress?: string;
  initialDeliveryTip?: number;
}

const Checkout: React.FC<CheckoutScreenProps> = ({
  initialCartItems,
  initialDeliveryAddress,
  initialDeliveryTip,
}) => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { appConfig } = useAppConfig();
  
  // Use CartContext instead of local state
  const {
    cartItems: contextCartItems,
    serverPricing,
    refreshCartWithPricingContext,
    flushAndRefreshCart,
    syncing,
  } = useCart();
  /** Cart screen: coupons priced as COD; user chooses card/UPI/cash on Payment screen */
  const CHECKOUT_PRICING_PAYMENT_METHOD = 'COD';

  const tipAmounts = appConfig.checkout?.tipAmounts ?? [10, 20, 30];
  const deliveryInstructions = appConfig.checkout?.deliveryInstructions ?? ['No Contact Delivery', "Don't ring the bell", 'Pet at home'];
  
  // Detect if this is the Cart tab (in tab navigator) or Checkout screen (in stack navigator)
  const isCartTab = route.name === 'Cart';
  const isCheckoutScreen = route.name === 'Checkout';
  
  // Always show back button for "My Cart" screen
  const showBackButton = true;
  
  // Handle back navigation - navigate to previous screen
  const handleBackPress = () => {
    if (isCartTab) {
      // We're in tab navigator (Cart tab)
      // Check parent navigator to see if we're in MainTabs
      const parentNavigation = navigation.getParent();
      if (parentNavigation) {
        const parentState = (parentNavigation as any).getState();
        const parentRoutes = parentState?.routes || [];
        const currentIndex = parentState?.index || 0;
        const currentRoute = parentRoutes[currentIndex];
        const isInMainTabs = currentRoute?.name === 'MainTabs';
        
        if (isInMainTabs) {
          // We're in MainTabs - check which tab was active before Cart
          const mainTabsState = currentRoute?.state;
          const mainTabsRoutes = mainTabsState?.routes || [];
          const mainTabsIndex = mainTabsState?.index || 0;
          
          // If Cart is at index 2, previous tabs would be Home (0) or Categories (1)
          // Check the history to see which tab was active before
          const tabHistory = mainTabsState?.history || [];
          
          // If there's history and the last tab before Cart was Home, go to Home
          // Otherwise, default to Home tab
          // For now, always navigate to Home tab when back is pressed from Cart
          navigation.navigate('MainTabs', {
            screen: 'Home',
          });
        } else {
          // Not in MainTabs - check if previous route in parent stack
          // If previous route exists and is not a login/auth screen, go back
          // Otherwise, navigate to MainTabs with Home
          if (currentIndex > 0) {
            const previousRoute = parentRoutes[currentIndex - 1];
            const previousRouteName = previousRoute?.name;
            
            // Skip auth screens (Login, OTPVerification, Onboarding) - navigate to Home instead
            const authScreens = ['Login', 'OTPVerification', 'Onboarding', 'NoInternet'];
            if (authScreens.includes(previousRouteName)) {
              // Previous screen is auth, navigate to MainTabs with Home
              (parentNavigation as any).navigate('MainTabs', {
                screen: 'Home',
              });
            } else if (previousRouteName === 'Home' || previousRouteName === 'MainTabs') {
              // Previous route is Home/MainTabs, navigate to Home tab
              navigation.navigate('MainTabs', {
                screen: 'Home',
              });
            } else {
              // Previous route is a product/other screen, go back to it
              (parentNavigation as any).goBack();
            }
          } else {
            // No previous route, navigate to Home tab
            navigation.navigate('MainTabs', {
              screen: 'Home',
            });
          }
        }
      } else {
        // No parent navigator, navigate to Home tab
        navigation.navigate('MainTabs', {
          screen: 'Home',
        });
      }
    } else {
      // We're in stack navigator (Checkout screen)
      // Check what the previous route was
      const navState = navigation.getState();
      const routes = navState?.routes || [];
      const currentIndex = navState?.index || 0;
      
      if (currentIndex > 0) {
        const previousRoute = routes[currentIndex - 1];
        const previousRouteName = previousRoute?.name;
        
        // Skip auth screens - navigate to MainTabs with Home instead
        const authScreens = ['Login', 'OTPVerification', 'Onboarding', 'NoInternet'];
        if (authScreens.includes(previousRouteName)) {
          navigation.navigate('MainTabs', {
            screen: 'Home',
          });
        } else if (previousRouteName === 'Home' || previousRouteName === 'MainTabs') {
          // Previous route is Home/MainTabs, navigate to MainTabs with Home
          navigation.navigate('MainTabs', {
            screen: 'Home',
          });
        } else {
          // Otherwise, go back to previous screen
          navigation.goBack();
        }
      } else {
        // No previous screen, navigate to MainTabs with Home as fallback
        navigation.navigate('MainTabs', {
          screen: 'Home',
        });
      }
    }
  };
  
  // Convert CartContext items to CartItemData format for display
  const cartItems: CartItemData[] = useMemo(() => {
    return contextCartItems.map((item: CartContextItem) => ({
      id: item.id || `${item.productId}::${item.variantId}`,
      productId: item.productId,
      variantId: item.variantId,
      name: item.productName,
      weight: item.variantSize || '1 unit', // Use variantSize as weight, fallback to '1 unit'
      quantity: item.quantity,
      discountedPrice: Number(item.price) || 0,
      originalPrice: Number(item.originalPrice ?? item.price) || 0,
      image: resolveCartLineImageUrl({
        productId: item.productId,
        productName: item.productName,
        image: item.image,
      }),
    }));
  }, [contextCartItems]);
  
  // Delivery address state
  const [deliveryAddress, setDeliveryAddress] = useState<string | undefined>(
    initialDeliveryAddress || undefined
  );
  const [deliveryAddressTitle, setDeliveryAddressTitle] = useState<string | undefined>(undefined);
  const [addressId, setAddressId] = useState<string | undefined>(undefined);
  const addressIdRef = useRef<string | undefined>(undefined);
  
  // Delivery tip state
  const [deliveryTip, setDeliveryTip] = useState<number | undefined>(
    initialDeliveryTip
  );
  const [showCustomTipModal, setShowCustomTipModal] = useState(false);
  const [customTipAmount, setCustomTipAmount] = useState('');
  
  // Delivery instructions state
  const [selectedInstructions, setSelectedInstructions] = useState<string[]>([]);
  const [additionalInstructions, setAdditionalInstructions] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  /** When checked, persist customer details to the account after payment starts successfully */
  const [saveContactForFuture, setSaveContactForFuture] = useState(false);
  const [paymentInitError, setPaymentInitError] = useState<string | null>(null);
  const [isPayNowLoading, setIsPayNowLoading] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

  // Applied coupon state
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount: number;
    displayName?: string;
    isCashback?: boolean;
    cashbackValue?: number;
  } | null>(null);

  // New coupon states
  const [couponCode, setCouponCode] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [nudgeBanner, setNudgeBanner] = useState<Coupon | null>(null);
  const [nudgeGap, setNudgeGap] = useState<number | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);

  const { location: contextLocation, assignedStore } = useLocation();
  const { user, userKey } = useUser();

  // Dynamic delivery fee and ETA from backend
  const [dynamicDeliveryFee, setDynamicDeliveryFee] = useState(0);
  const [dynamicSurgeCharge, setDynamicSurgeCharge] = useState(0);
  const [deliveryPromiseText, setDeliveryPromiseText] = useState('');

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardInset(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!assignedStore?.id || !contextLocation) return;
    const { deliveryService } = require('../services/delivery/deliveryService');
    const itemTotal = cartItems.reduce(
      (s: number, i) => s + (i.discountedPrice || 0) * (i.quantity || 1),
      0,
    );
    deliveryService.getFee(assignedStore.id, contextLocation.latitude, contextLocation.longitude, itemTotal)
      .then((res: any) => {
        setDynamicDeliveryFee((res.deliveryFee || 0) + (res.handlingCharge || 0));
        setDynamicSurgeCharge(res.surgeCharge || 0);
      })
      .catch(() => {});
    deliveryService.getEstimate(assignedStore.id, contextLocation.latitude, contextLocation.longitude, cartItems.length)
      .then((res: any) => {
        setDeliveryPromiseText(res.promiseText || '');
      })
      .catch(() => {});
  }, [assignedStore?.id, contextLocation, cartItems]);

  const pricingContext = useMemo(
    () => ({
      couponCode: appliedCoupon?.code,
      zone: contextLocation?.area || undefined,
      paymentMethod: CHECKOUT_PRICING_PAYMENT_METHOD,
    }),
    [appliedCoupon?.code, contextLocation?.area]
  );
  const pricingContextRef = useRef(pricingContext);
  pricingContextRef.current = pricingContext;
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    addressIdRef.current = addressId;
  }, [addressId]);

  const applyCheckoutAddress = useCallback((addr: Address) => {
    addressIdRef.current = addr._id;
    setAddressId(addr._id);
    setDeliveryAddressTitle(addr.label || 'Home');
    const parts = [addr.line1, addr.line2, addr.landmark, addr.city, addr.state, addr.pincode].filter(
      Boolean,
    );
    setDeliveryAddress(parts.join(', '));
  }, []);

  const loadCheckoutAddress = useCallback(async () => {
    try {
      const res = await addressService.getAll();
      if (!res?.success || !Array.isArray(res.data) || res.data.length === 0) {
        addressIdRef.current = undefined;
        setAddressId(undefined);
        setDeliveryAddress(undefined);
        setDeliveryAddressTitle(undefined);
        return;
      }
      const list = res.data;
      const preferredId = addressIdRef.current;
      const selected =
        (preferredId ? list.find((a) => a._id === preferredId) : undefined) ||
        list.find((a) => a.isDefault) ||
        list[0];
      if (selected) {
        applyCheckoutAddress(selected);
      }
    } catch {
      logger.warn('Failed to fetch addresses for checkout');
    }
  }, [applyCheckoutAddress]);

  // Button press animations (max 6 tip buttons: 5 presets + custom)
  const paymentButtonScale = useRef(new Animated.Value(1)).current;
  const tipButtonScales = useRef(
    Array.from({ length: 6 }, () => new Animated.Value(1))
  ).current;
  const instructionButtonScales = useRef(
    Array.from({ length: 3 }, () => new Animated.Value(1))
  ).current;

  // Expandable section animations
  const deliveryInstructionsHeight = useRef(new Animated.Value(0)).current;
  const deliveryInstructionsOpacity = useRef(new Animated.Value(0)).current;
  const [isDeliveryInstructionsExpanded, setIsDeliveryInstructionsExpanded] = useState(true);

  // Empty cart animation
  const emptyCartOpacity = useRef(new Animated.Value(0)).current;
  const emptyCartScale = useRef(new Animated.Value(0.9)).current;

  // Animation refs for cart items (optional entrance animation for first lines)
  const cartItemAnimations = useRef(
    Array.from({ length: 20 }, () => ({
      opacity: new Animated.Value(1),
      translateX: new Animated.Value(0),
    }))
  ).current;
  
  // Fetch default address and cart when screen gains focus (not when pricingContext/user changes while focused).
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      refreshCartWithPricingContext(pricingContextRef.current).catch(() => {});
      const loadCheckoutContactFields = async () => {
        try {
          const token = await tokenManager.getAccessToken();
          if (!mounted || !token) {
            if (mounted) {
              setCustomerName('');
              setCustomerEmail('');
              setCustomerPhone('');
              setSaveContactForFuture(false);
            }
            return;
          }
          // Show account details immediately while the profile request loads; server may override with savedCheckoutContact.
          if (mounted) {
            const currentUser = userRef.current;
            const optimisticName =
              (currentUser as { name?: string; fullName?: string } | null)?.name ??
              (currentUser as { fullName?: string } | null)?.fullName;
            if (optimisticName) {
              setCustomerName(String(optimisticName));
            } else {
              setCustomerName('');
            }
            setCustomerEmail(currentUser?.email != null ? String(currentUser.email) : '');
            setCustomerPhone(currentUser?.phoneNumber != null ? String(currentUser.phoneNumber) : '');
            setSaveContactForFuture(false);
          }
          const res = await userService.getProfile();
          const profile = res?.success && res.data ? res.data : null;
          const rawSc = profile?.savedCheckoutContact as
            | { fullName?: string; email?: string; phone?: string }
            | undefined;
          const sc = rawSc
            ? {
                fullName:
                  rawSc.fullName != null && String(rawSc.fullName).trim()
                    ? String(rawSc.fullName).trim()
                    : undefined,
                email:
                  rawSc.email != null && String(rawSc.email).trim()
                    ? String(rawSc.email).trim()
                    : undefined,
                phone:
                  rawSc.phone != null && String(rawSc.phone).trim()
                    ? String(rawSc.phone).replace(/\s/g, '')
                    : undefined,
              }
            : undefined;
          if (!mounted) {
            return;
          }
          if (sc && (sc.fullName || sc.email || sc.phone)) {
            setCustomerName(sc.fullName != null ? String(sc.fullName) : '');
            setCustomerEmail(sc.email != null ? String(sc.email) : '');
            setCustomerPhone(sc.phone != null ? String(sc.phone) : '');
            setSaveContactForFuture(true);
            return;
          }
          const name =
            (userRef.current as { name?: string; fullName?: string } | null)?.name ??
            (userRef.current as { fullName?: string } | null)?.fullName;
          if (name) {
            setCustomerName(String(name));
          } else {
            setCustomerName('');
          }
          setCustomerEmail(userRef.current?.email != null ? String(userRef.current.email) : '');
          setCustomerPhone(userRef.current?.phoneNumber != null ? String(userRef.current.phoneNumber) : '');
          setSaveContactForFuture(false);
        } catch {
          logger.warn('Failed to load profile for checkout contact');
          if (!mounted) {
            return;
          }
          const name =
            (userRef.current as { name?: string; fullName?: string } | null)?.name ??
            (userRef.current as { fullName?: string } | null)?.fullName;
          if (name) {
            setCustomerName(String(name));
          } else {
            setCustomerName('');
          }
          setCustomerEmail(userRef.current?.email != null ? String(userRef.current.email) : '');
          setCustomerPhone(userRef.current?.phoneNumber != null ? String(userRef.current.phoneNumber) : '');
          setSaveContactForFuture(false);
        }
      };
      void loadCheckoutAddress();
      loadCheckoutContactFields();
      return () => { mounted = false; };
    }, [loadCheckoutAddress, refreshCartWithPricingContext])
  );

  useEffect(() => {
    return subscribeAddressesChanged(() => {
      void loadCheckoutAddress();
    });
  }, [loadCheckoutAddress]);

  const prevPricingContextKeyRef = useRef('');
  useEffect(() => {
    const key = JSON.stringify(pricingContext);
    if (
      prevPricingContextKeyRef.current &&
      prevPricingContextKeyRef.current !== key &&
      isFocused &&
      !syncing
    ) {
      refreshCartWithPricingContext(pricingContext).catch(() => {});
    }
    prevPricingContextKeyRef.current = key;
  }, [pricingContext, isFocused, syncing, refreshCartWithPricingContext]);

  // Animate cart items when screen is focused or when items change
  const lastAnimatedLength = useRef(0);
  const isInitialFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      const currentLength = cartItems.length;
      const shouldAnimateEntry = isInitialFocus.current || (lastAnimatedLength.current === 0 && currentLength > 0);
      
      if (currentLength > 0) {
        if (shouldAnimateEntry) {
          // Staggered animation for cart items - only on first load or 0->N transition
          cartItems.forEach((_, index) => {
            const anim = cartItemAnimations[index];
            if (anim) {
              anim.opacity.setValue(0);
              anim.translateX.setValue(30);
              
              Animated.parallel([
                Animated.timing(anim.opacity, {
                  toValue: 1,
                  duration: 400,
                  delay: index * 80,
                  easing: Easing.out(Easing.cubic),
                  useNativeDriver: true,
                }),
                Animated.timing(anim.translateX, {
                  toValue: 0,
                  duration: 400,
                  delay: index * 80,
                  easing: Easing.out(Easing.cubic),
                  useNativeDriver: true,
                }),
              ]).start();
            }
          });
        } else {
          // Just ensure items are visible without re-triggering slide-in
          cartItems.forEach((_, index) => {
            const anim = cartItemAnimations[index];
            if (anim) {
              anim.opacity.setValue(1);
              anim.translateX.setValue(0);
            }
          });
        }

        // Hide empty cart animation
        emptyCartOpacity.setValue(0);
        emptyCartScale.setValue(0.9);
      } else {
        // Show empty cart animation
        Animated.parallel([
          Animated.timing(emptyCartOpacity, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(emptyCartScale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
          }),
        ]).start();
      }
      
      lastAnimatedLength.current = currentLength;
      isInitialFocus.current = false;
      
      return () => {
        // We don't reset isInitialFocus here because we want to keep it false
        // as long as the screen is in the navigation stack and just losing focus.
        // But useFocusEffect's cleanup runs when losing focus.
      };
    }, [cartItems.length])
  );

  // Reset isInitialFocus when the screen is completely unmounted
  useEffect(() => {
    return () => {
      isInitialFocus.current = true;
    };
  }, []);

  // Handle coupon applied from Coupons screen
  // This works for both stack navigation (Checkout screen) and tab navigation (Cart tab)
  useFocusEffect(
    useCallback(() => {
      const params = route.params as { appliedCoupon?: { code: string; discount: number } } | undefined;
      if (params?.appliedCoupon) {
        setAppliedCoupon(params.appliedCoupon);
        // Clear params after applying to prevent re-applying on subsequent focuses
        // Only clear if we can set params (works for both stack and tab navigation)
        try {
          navigation.setParams({ appliedCoupon: undefined } as any);
        } catch (error) {
          // If setParams fails (e.g., in tab navigator), that's okay
          // The params will be cleared on next navigation anyway
        }
      }
    }, [route.params, navigation])
  );

  // Calculate bill summary from server pricing to match order creation/worldline amount.
  const calculateBillSummary = (): BillSummaryData => {
    const localItemTotal = cartItems.reduce(
      (sum, item) => sum + item.discountedPrice * item.quantity,
      0
    );
    const localItemTotalOriginal = cartItems.reduce(
      (sum, item) => sum + item.originalPrice * item.quantity,
      0
    );
    
    // Calculate GST based on item-specific rates
    const gstAmount = contextCartItems.reduce((sum, item) => {
      const gstRate = (item as any).gstRate || 0;
      const lineTotal = item.price * item.quantity;
      // GST = Line Total * (Rate / (100 + Rate))
      return sum + lineTotal * (gstRate / (100 + gstRate));
    }, 0);

    const hasServerPricing = serverPricing.itemTotal > 0 || serverPricing.total > 0;
    const itemTotal = hasServerPricing ? serverPricing.itemTotal : localItemTotal;
    const itemTotalOriginal = Math.max(localItemTotalOriginal, itemTotal);
    const totalSavings = Math.max(0, itemTotalOriginal - itemTotal);
    const handlingCharge = hasServerPricing
      ? serverPricing.handlingCharge
      : (appConfig.checkout?.handlingCharge ?? 5);
    const deliveryFee = hasServerPricing
      ? serverPricing.deliveryFee + dynamicSurgeCharge
      : dynamicDeliveryFee + dynamicSurgeCharge;
    const tipAmount = deliveryTip || 0;
    const couponDiscount = hasServerPricing
      ? serverPricing.discount
      : (appliedCoupon?.discount || 0);
    const merchandiseTotal = itemTotal + handlingCharge + deliveryFee - couponDiscount;
    const serverGrandTotal = serverPricing.total > 0 ? serverPricing.total : 0;
    const totalBill =
      serverGrandTotal > 0 ? serverGrandTotal + tipAmount : Math.max(0, merchandiseTotal + tipAmount);

    return {
      itemTotal,
      itemTotalOriginal,
      gstAmount,
      deliveryFee,
      handlingCharge,
      totalSavings,
      deliveryTip: tipAmount > 0 ? tipAmount : undefined,
      couponDiscount: couponDiscount > 0 ? couponDiscount : undefined,
      totalBill: Math.max(0, totalBill),
    };
  };

  // Handle apply coupon
  const handleApplyCoupon = async (codeOverride?: string) => {
    const codeToApply = (codeOverride || couponCode).trim().toUpperCase();
    if (!codeToApply) return;

    setIsApplyingCoupon(true);
    setCouponError(null);

    try {
      const billSummary = calculateBillSummary();
      const result = await couponService.validateCoupon({
        coupon_code: codeToApply,
        user_id: userKey,
        cart_items: contextCartItems.map(item => ({
          productId: item.productId,
          sku_id: (item as any).sku, // Mapping to backend expectations
          category: (item as any).categoryId,
          price: item.price,
          qty: item.quantity,
          is_on_sale: (item as any).isOnSale || false
        })),
        cart_value: billSummary.itemTotal,
        payment_method: CHECKOUT_PRICING_PAYMENT_METHOD,
        zone: contextLocation?.area || '',
        delivery_fee: billSummary.deliveryFee
      });

      if (result.success && result.data?.valid) {
        setAppliedCoupon({
          code: codeToApply,
          discount: result.data.discount_amount || 0,
          displayName: result.data.display_name,
          isCashback: result.data.is_cashback,
          cashbackValue: result.data.cashback_value
        });
        setCouponCode('');
        Toast.show({
          type: 'success',
          text1: `You saved ₹${result.data.discount_amount} with ${codeToApply}`,
          text2: result.data.is_cashback ? `₹${result.data.cashback_value} will be added to your wallet after delivery` : undefined
        });
      } else {
        const errorCode = result.data?.error_code;
        let errorMessage = 'Could not apply coupon';
        
        if (errorCode === 'INVALID_CODE') errorMessage = "This coupon code doesn't exist";
        else if (errorCode === 'COUPON_INACTIVE') errorMessage = "This offer has ended";
        else if (errorCode === 'COUPON_NOT_VALID_NOW') errorMessage = "This coupon is not valid right now";
        else if (errorCode === 'NOT_ELIGIBLE') errorMessage = "This offer is not available for your account";
        else if (errorCode === 'MIN_ORDER_NOT_MET') {
          const gap = (result.data?.min_required || 0) - billSummary.itemTotal;
          errorMessage = `Add ₹${gap.toFixed(0)} more to use this coupon`;
        }
        else if (errorCode === 'COUPON_EXHAUSTED') errorMessage = "This offer has ended — all coupons have been claimed";
        else if (errorCode === 'PAYMENT_METHOD_NOT_ELIGIBLE') errorMessage = `This coupon works only with ${result.data?.allowed || 'certain'} payments`;
        
        setCouponError(errorMessage);
        Toast.show({
          type: 'error',
          text1: 'Coupon Error',
          text2: errorMessage
        });
      }
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setCouponError(msg);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponCode('');
  };

  // Fetch coupons for nudge banner
  const fetchAvailableCoupons = useCallback(async () => {
    if (!isCartTab) return;
    try {
      const billSummary = calculateBillSummary();
      const res = await couponService.listCoupons({
        user_id: userKey,
        cart_value: billSummary.itemTotal,
        zone: contextLocation?.area || '',
        payment_method: CHECKOUT_PRICING_PAYMENT_METHOD,
      });

      if (res.success && res.data?.coupons) {
        const coupons = res.data.coupons;
        setAvailableCoupons(coupons);

        // Nudge logic
        if (!appliedCoupon) {
          // 1. Find eligible coupon with CART_NUDGE section
          const nudgeCoupon = coupons.find(c => c.showInSections?.includes('CART_NUDGE'));
          if (nudgeCoupon) {
            setNudgeBanner(nudgeCoupon);
            setNudgeGap(null);
          } else {
            // 2. Find coupon close to min_order_value (within ₹50)
            const closeCoupon = coupons.find(c => {
              const gap = c.minOrderValue - billSummary.itemTotal;
              return gap > 0 && gap <= 50;
            });
            if (closeCoupon) {
              setNudgeBanner(closeCoupon);
              setNudgeGap(closeCoupon.minOrderValue - billSummary.itemTotal);
            } else {
              setNudgeBanner(null);
              setNudgeGap(null);
            }
          }
        } else {
          setNudgeBanner(null);
          setNudgeGap(null);
        }
      }
    } catch (err) {
      logger.warn('Failed to fetch coupons for nudge', err);
    }
  }, [isCartTab, userKey, contextLocation?.area, appliedCoupon, cartItems, serverPricing.itemTotal]);

  useRefreshAppConfigOnFocus();

  useFocusEffect(
    useCallback(() => {
      void fetchAvailableCoupons();
    }, [fetchAvailableCoupons])
  );

  const handleAddressPress = () => {
    navigation.navigate('Addresses');
  };

  // Handle change address press
  const handleChangeAddressPress = () => {
    navigation.navigate('Addresses');
  };

  // Handle custom tip
  const handleCustomTip = () => {
    const isPreset = tipAmounts.includes(deliveryTip ?? 0);
    setCustomTipAmount(deliveryTip && !isPreset ? deliveryTip.toString() : '');
    setShowCustomTipModal(true);
  };

  // Handle apply custom tip
  const handleApplyCustomTip = () => {
    const tipAmount = parseFloat(customTipAmount);
    if (!isNaN(tipAmount) && tipAmount >= 0) {
      setDeliveryTip(tipAmount);
      setShowCustomTipModal(false);
      setCustomTipAmount('');
    }
  };

  // Handle cancel custom tip
  const handleCancelCustomTip = () => {
    setShowCustomTipModal(false);
    setCustomTipAmount('');
  };

  // Handle delivery instruction toggle with animation
  const handleInstructionToggle = (instruction: string) => {
    const index = instruction === 'no-contact' ? 0 : instruction === 'no-bell' ? 1 : 2;
    // Animate button press
    Animated.sequence([
      Animated.timing(instructionButtonScales[index], {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(instructionButtonScales[index], {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
    ]).start();

    setSelectedInstructions((prev) => {
      if (prev.includes(instruction)) {
        return prev.filter((i) => i !== instruction);
      } else {
        return [...prev, instruction];
      }
    });
  };

  const handlePayNow = async () => {
    setPaymentInitError(null);
    const name = customerName.trim();
    const email = customerEmail.trim();
    const phone = customerPhone.replace(/\s/g, '');

    if (!name) {
      Toast.show({ type: 'error', text1: 'Enter your name' });
      return;
    }
    if (!email && !phone) {
      Toast.show({ type: 'error', text1: 'Enter your email or phone' });
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Toast.show({ type: 'error', text1: 'Enter a valid email' });
      return;
    }
    if (!addressId) {
      Toast.show({ type: 'error', text1: 'Select a delivery address', text2: 'Tap Change to add or pick an address' });
      return;
    }
    if (cartItems.length === 0) {
      Toast.show({ type: 'error', text1: 'Your cart is empty' });
      return;
    }

    const token = await getToken();
    if (!token) {
      const msg = 'Please login';
      setPaymentInitError(msg);
      Toast.show({ type: 'error', text1: msg });
      return;
    }

    Keyboard.dismiss();

    Animated.sequence([
      Animated.timing(paymentButtonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(paymentButtonScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
    ]).start();

    setIsPayNowLoading(true);
    try {
      await flushAndRefreshCart(pricingContextRef.current);
      const billSummary = calculateBillSummary();
      if (saveContactForFuture) {
        updateProfile({
          savedCheckoutContact: {
            fullName: name,
            email: email || undefined,
            phone: phone || undefined,
          },
        }).catch((err) => {
          logger.warn('Failed to save checkout contact for future use', err);
        });
      }
      navigation.navigate('Payment', {
        totalBill: billSummary.totalBill,
        itemCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
        deliveryTip: deliveryTip,
        appliedCoupon: appliedCoupon || undefined,
        addressId: addressId,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not continue to payment';
      setPaymentInitError(msg);
      Toast.show({ type: 'error', text1: 'Payment', text2: msg });
    } finally {
      setIsPayNowLoading(false);
    }
  };

  // Handle tip button select with animation
  const handleTipSelect = (amount: number) => {
    const index = tipAmounts.indexOf(amount);
    const animIndex = index >= 0 ? index : Math.min(tipAmounts.length, 5);
    // Animate button press
    Animated.sequence([
      Animated.timing(tipButtonScales[animIndex], {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(tipButtonScales[animIndex], {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
    ]).start();
    
    setDeliveryTip(amount);
    // TODO: Update tip via API
  };

  // Handle add more press - navigate to home page
  const handleAddMorePress = () => {
    if (isCartTab) {
      navigation.navigate('Home');
      return;
    }
    const parent = navigation.getParent();
    if (parent) {
      (parent as any).navigate('MainTabs', { screen: 'Home' });
      return;
    }
    navigation.navigate('MainTabs', { screen: 'Home' });
  };

  const billSummary = calculateBillSummary();
  const itemCount = `${cartItems.reduce((sum, item) => sum + item.quantity, 0)} ${cartItems.reduce((sum, item) => sum + item.quantity, 0) === 1 ? 'item' : 'items'}`;

  useEffect(() => {
    let mounted = true;
    const logBackendVsDisplayedTotals = async () => {
      try {
        const res = await cartApiService.getCart(pricingContext);
        if (!mounted || !res?.success || !res.data) return;
        const backendCart = res.data;
        logger.info('[checkout-pricing-debug] backend_vs_display', {
          backend: {
            itemTotal: Number(backendCart.itemTotal || 0),
            discount: Number(backendCart.discount || 0),
            deliveryFee: Number(backendCart.deliveryFee || 0),
            handlingCharge: Number(backendCart.handlingCharge || 0),
            total: Number(backendCart.total || 0),
          },
          displayed: {
            itemTotal: Number(billSummary.itemTotal || 0),
            discount: Number(billSummary.couponDiscount || 0),
            deliveryFee: Number(billSummary.deliveryFee || 0),
            handlingCharge: Number(billSummary.handlingCharge || 0),
            total: Number(billSummary.totalBill || 0),
          },
        });
      } catch (error) {
        logger.warn('[checkout-pricing-debug] backend_vs_display_failed', error);
      }
    };
    logBackendVsDisplayedTotals();
    return () => {
      mounted = false;
    };
  }, [
    contextCartItems,
    pricingContext,
    billSummary.itemTotal,
    billSummary.handlingCharge,
    billSummary.deliveryFee,
    billSummary.totalBill,
    billSummary.couponDiscount,
  ]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
      >
      <Header 
        title="My Cart" 
        itemCount={cartItems.length > 0 ? itemCount : undefined}
        onAddMorePress={cartItems.length > 0 ? handleAddMorePress : undefined}
        showBackButton={showBackButton}
        onBackPress={showBackButton ? handleBackPress : undefined}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          cartItems.length === 0 ? styles.scrollContentEmpty : styles.scrollContent,
          {
            paddingBottom:
              cartItems.length > 0
                ? CHECKOUT_FOOTER_SCROLL_CLEARANCE + Math.max(insets.bottom, 12) + keyboardInset
                : Math.max(insets.bottom, 16),
          },
        ]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={() => Keyboard.dismiss()}
      >
        {/* Product list container */}
        <View style={styles.productListContainer}>
          {/* Coupon and Nudge Section - Only show when cart has items */}
          {cartItems.length > 0 && (
            <View style={styles.couponContainer}>
              {/* Nudge Banner */}
              {nudgeBanner && !appliedCoupon && (
                <View style={styles.nudgeBanner}>
                  <View style={styles.nudgeContent}>
                    <CouponIcon width={16} height={16} />
                    <Text style={styles.nudgeText}>
                      {nudgeGap 
                        ? `Add ₹${nudgeGap.toFixed(0)} more to unlock ${nudgeBanner.code}`
                        : `Use ${nudgeBanner.code} — ${nudgeBanner.displayName || nudgeBanner.description}`}
                    </Text>
                  </View>
                  {!nudgeGap && (
                    <TouchableOpacity
                      style={styles.nudgeApplyButton}
                      onPress={() => handleApplyCoupon(nudgeBanner.code)}
                    >
                      <Text style={styles.nudgeApplyText}>Apply</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Coupon Input UI */}
              <View style={styles.couponInputWrapper}>
                <View style={styles.couponInputContainer}>
                  <TextInput
                    style={styles.couponInput}
                    placeholder="Enter coupon code"
                    placeholderTextColor="rgba(107, 107, 107, 0.5)"
                    value={couponCode}
                    onChangeText={(t) => setCouponCode(t.toUpperCase().replace(/\s/g, ''))}
                    editable={!isApplyingCoupon && !appliedCoupon}
                  />
                  {!appliedCoupon ? (
                    <TouchableOpacity
                      style={[styles.applyButton, !couponCode && styles.applyButtonDisabled]}
                      onPress={() => handleApplyCoupon()}
                      disabled={!couponCode || isApplyingCoupon}
                    >
                      {isApplyingCoupon ? (
                        <ActivityIndicator size="small" color="#034703" />
                      ) : (
                        <Text style={styles.applyButtonText}>Apply</Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.removeCouponButton}
                      onPress={handleRemoveCoupon}
                    >
                      <Text style={styles.removeCouponButtonText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Success/Error Banners */}
                {appliedCoupon && (
                  <View style={styles.couponSuccessBanner}>
                    <Text style={styles.couponSuccessText}>
                      You saved ₹{appliedCoupon.discount} with {appliedCoupon.code}
                    </Text>
                    {appliedCoupon.isCashback && (
                      <Text style={styles.couponCashbackText}>
                        ₹{appliedCoupon.cashbackValue} will be added to your wallet after delivery
                      </Text>
                    )}
                  </View>
                )}

                {couponError && (
                  <View style={styles.couponErrorBanner}>
                    <Text style={styles.couponErrorText}>{couponError}</Text>
                  </View>
                )}
              </View>

              {/* View All Coupons Link */}
              {!appliedCoupon && (
                <TouchableOpacity
                  style={styles.viewCouponsLink}
                  onPress={() => navigation.navigate('Coupons')}
                  activeOpacity={0.7}
                >
                  <View style={styles.viewCouponsContent}>
                    <Text style={styles.viewCouponsText}>View Coupons & Offers</Text>
                    <PlusIcon width={12} height={12} fill="#034703" />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Cart Items - Animated */}
          {cartItems.length > 0 ? (
            cartItems.map((item, index) => {
              const anim = cartItemAnimations[index];
              const row = <CartItem item={item} />;
              if (!anim) {
                return (
                  <View key={item.id} style={styles.cartItemWrapper}>
                    {row}
                  </View>
                );
              }

              return (
                <Animated.View
                  key={item.id}
                  style={[
                    styles.cartItemWrapper,
                    {
                      opacity: anim.opacity,
                      transform: [{ translateX: anim.translateX }],
                    },
                  ]}
                >
                  {row}
                </Animated.View>
              );
            })
          ) : (
            <Animated.View
              style={[
                styles.emptyCartContainer,
                {
                  opacity: emptyCartOpacity,
                  transform: [{ scale: emptyCartScale }],
                },
              ]}
            >
              {/* Empty Cart Image */}
              <View style={styles.emptyCartImageContainer}>
                <Image
                  source={require('../assets/images/empty-cart-image.png')}
                  style={styles.emptyCartImage}
                  resizeMode="contain"
                />
              </View>

              {/* Title */}
              <Text style={styles.emptyCartTitle}>Your cart is empty</Text>

              {/* Subtitle */}
              <Text style={styles.emptyCartSubtitle}>Add fresh organic items to get started</Text>

              {/* Warning Card */}
              <View style={styles.emptyCartWarningCard}>
                <View style={styles.emptyCartWarningContent}>
                  <View style={styles.emptyCartWarningIconContainer}>
                    <View style={styles.emptyCartWarningIconCircle}>
                      <Text style={styles.emptyCartWarningIcon}>⚠</Text>
                    </View>
                  </View>
                  <View style={styles.emptyCartWarningTextContainer}>
                    <Text style={styles.emptyCartWarningTitle}>
                      {appConfig.checkout?.emptyCartTitle ?? "Don't Risk Your Health"}
                    </Text>
                    <Text style={styles.emptyCartWarningDescription}>
                      {appConfig.checkout?.emptyCartDescription ?? 'Avoid poison on your plate. Fill your cart with lab-tested, toxin-free groceries now.'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Browse Button */}
              <TouchableOpacity
                style={styles.emptyCartButton}
                onPress={handleAddMorePress}
                activeOpacity={0.8}
              >
                <ShopIcon color="#FFFFFF" size={14} />
                <Text style={styles.emptyCartButtonText} numberOfLines={1}>
                  {appConfig.checkout?.emptyCartCta ?? 'Browse healthy products'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Only show checkout sections when cart has items */}
          {cartItems.length > 0 && (
            <>
              {/* Delivery Partner Tip Section */}
              <View style={styles.tipSection}>
            <View style={styles.tipContent}>
              <View style={styles.tipInfo}>
                <View style={styles.tipTextContainer}>
                  <Text style={styles.tipTitle}>Delivery Partner Tip</Text>
                  <Text style={styles.tipDescription}>This amount goes to your delivery partner.</Text>
                </View>
                <View style={styles.tipOptionsContainer}>
                  <View style={styles.tipButtonsRow}>
                    {tipAmounts.slice(0, 5).map((amount, idx) => (
                      <Animated.View key={amount} style={{ transform: [{ scale: tipButtonScales[idx] }] }}>
                        <TouchableOpacity
                          style={[
                            styles.tipButton,
                            amount !== tipAmounts[0] && styles.tipButtonMedium,
                            deliveryTip === amount && styles.tipButtonSelected
                          ]}
                          onPress={() => handleTipSelect(amount)}
                          activeOpacity={1}
                        >
                          <View style={amount === tipAmounts[0] ? styles.tipButtonContent : styles.tipButtonContentMedium}>
                            <TipIcon width={12} height={12} />
                            <Text style={styles.tipButtonText}>₹{amount}</Text>
                          </View>
                        </TouchableOpacity>
                      </Animated.View>
                    ))}
                  </View>
                  <Animated.View style={{ transform: [{ scale: tipButtonScales[Math.min(tipAmounts.length, 5)] }] }}>
                    <TouchableOpacity
                      style={[
                        styles.tipButton,
                        styles.tipButtonCustom,
                        (deliveryTip && !tipAmounts.includes(deliveryTip)) ? styles.tipButtonSelected : undefined
                      ]}
                      onPress={handleCustomTip}
                      activeOpacity={1}
                    >
                      <View style={styles.tipButtonCustomContainer}>
                        <Text style={styles.tipButtonText} numberOfLines={1}>Custom</Text>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              </View>
              <View style={styles.tipImageContainer}>
                <Image 
                  source={require('../assets/images/tip-image.png')} 
                  style={styles.tipImage}
                  resizeMode="cover"
                />
              </View>
            </View>
          </View>

          {/* Bill Summary */}
          <View style={styles.billSummaryWrapper}>
            <BillSummary data={{
              ...billSummary,
              couponCode: appliedCoupon?.code
            }} />
          </View>

          <View style={styles.customerSection}>
            <Text style={styles.customerSectionTitle}>Customer details</Text>
            <Text style={styles.customerSectionHint}>Required for payment</Text>
            <Text style={styles.customerFieldLabel}>Full name</Text>
            <TextInput
              style={styles.customerInput}
              placeholder="Your name"
              placeholderTextColor="rgba(107, 107, 107, 0.5)"
              value={customerName}
              onChangeText={setCustomerName}
              autoCapitalize="words"
            />
            <Text style={styles.customerFieldLabel}>Email</Text>
            <TextInput
              style={styles.customerInput}
              placeholder="you@example.com"
              placeholderTextColor="rgba(107, 107, 107, 0.5)"
              value={customerEmail}
              onChangeText={setCustomerEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.customerFieldLabel}>Phone</Text>
            <TextInput
              style={styles.customerInput}
              placeholder="10-digit mobile"
              placeholderTextColor="rgba(107, 107, 107, 0.5)"
              value={customerPhone}
              onChangeText={setCustomerPhone}
              keyboardType="phone-pad"
            />
            <TouchableOpacity
              style={styles.saveContactRow}
              onPress={() => setSaveContactForFuture((v) => !v)}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: saveContactForFuture }}
            >
              <View
                style={[
                  styles.saveContactCheckbox,
                  saveContactForFuture ? styles.saveContactCheckboxChecked : undefined,
                ]}
              >
                {saveContactForFuture ? (
                  <Text style={styles.saveContactCheckmark}>✓</Text>
                ) : null}
              </View>
              <Text style={styles.saveContactLabel}>
                Save these details for faster checkout next time
              </Text>
            </TouchableOpacity>
            {paymentInitError ? (
              <View style={styles.paymentInitErrorBanner}>
                <Text style={styles.paymentInitErrorText}>{paymentInitError}</Text>
              </View>
            ) : null}
          </View>

          {/* Delivery Instructions Section */}
          <View style={styles.deliveryInstructionsSection}>
            <View style={styles.deliveryInstructionsContent}>
              <View style={styles.deliveryInstructionsHeader}>
                <View style={styles.deliveryInstructionsTextContainer}>
                  <Text style={styles.deliveryInstructionsTitle}>Delivery Instructions</Text>
                  <Text style={styles.deliveryInstructionsDescription}>Delivery partner will be notified</Text>
                </View>
                {/* Optional: Add an icon or image on the right if needed, similar to tip section */}
              </View>
              <View style={styles.deliveryInstructionsButtons}>
                <Animated.View style={{ transform: [{ scale: instructionButtonScales[0] }] }}>
                  <TouchableOpacity
                    style={[
                      styles.deliveryInstructionButton,
                      selectedInstructions.includes('no-contact') 
                        ? styles.deliveryInstructionButtonEnabled 
                        : styles.deliveryInstructionButtonDisabled
                    ]}
                    onPress={() => handleInstructionToggle('no-contact')}
                    activeOpacity={1}
                  >
                    <View style={styles.deliveryInstructionIconContainerNoContact}>
                      <NoContactDeliveryIcon width={77} height={14} />
                      {selectedInstructions.includes('no-contact') && (
                        <View style={styles.deliveryInstructionCheckmark}>
                          <Text style={styles.deliveryInstructionCheckmarkText}>✓</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.deliveryInstructionButtonText}>{deliveryInstructions[0] ?? 'No Contact Delivery'}</Text>
                  </TouchableOpacity>
                </Animated.View>
                <Animated.View style={{ transform: [{ scale: instructionButtonScales[1] }] }}>
                  <TouchableOpacity
                    style={[
                      styles.deliveryInstructionButton,
                      selectedInstructions.includes('no-bell') 
                        ? styles.deliveryInstructionButtonEnabled 
                        : styles.deliveryInstructionButtonDisabled
                    ]}
                    onPress={() => handleInstructionToggle('no-bell')}
                    activeOpacity={1}
                  >
                    <View style={styles.deliveryInstructionIconContainer}>
                      <DontRingBellIcon width={14} height={14} />
                      {selectedInstructions.includes('no-bell') && (
                        <View style={styles.deliveryInstructionCheckmark}>
                          <Text style={styles.deliveryInstructionCheckmarkText}>✓</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.deliveryInstructionButtonText}>{deliveryInstructions[1] ?? "Don't ring the bell"}</Text>
                  </TouchableOpacity>
                </Animated.View>
                <Animated.View style={{ transform: [{ scale: instructionButtonScales[2] }] }}>
                  <TouchableOpacity
                    style={[
                      styles.deliveryInstructionButton,
                      selectedInstructions.includes('pet') 
                        ? styles.deliveryInstructionButtonEnabled 
                        : styles.deliveryInstructionButtonDisabled
                    ]}
                    onPress={() => handleInstructionToggle('pet')}
                    activeOpacity={1}
                  >
                    <View style={styles.deliveryInstructionIconContainer}>
                      <PetAtHomeIcon width={14} height={14} />
                      {selectedInstructions.includes('pet') && (
                        <View style={styles.deliveryInstructionCheckmark}>
                          <Text style={styles.deliveryInstructionCheckmarkText}>✓</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.deliveryInstructionButtonText}>{deliveryInstructions[2] ?? 'Pet at home'}</Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </View>
          </View>

          {/* Additional Instructions Section */}
          <View style={styles.additionalInstructionsSection}>
            <View style={styles.additionalInstructionsContent}>
              <View style={styles.additionalInstructionsTextContainer}>
                <Text style={styles.additionalInstructionsTitle}>Additional Instructions (Optional)</Text>
                <Text style={styles.additionalInstructionsDescription}>
                  Add special delivery instructions for your order.
                </Text>
              </View>
              <TextInput
                style={styles.additionalInstructionsInput}
                placeholder="E.g., Leave at door, Call upon arrival..."
                placeholderTextColor="rgba(107, 107, 107, 0.5)"
                value={additionalInstructions}
                onChangeText={setAdditionalInstructions}
                multiline
                numberOfLines={3}
                blurOnSubmit
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
            </View>
          </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Bottom Payment Section - Only show when cart has items */}
      {cartItems.length > 0 && (
        <View
          style={[
            styles.bottomSection,
            {
              paddingBottom: Math.max(insets.bottom, 12),
              bottom: keyboardInset > 0 ? keyboardInset + 8 : 12,
            },
          ]}
        >
        <View style={styles.addressCard}>
          <View style={styles.addressCardContent}>
            <View style={styles.addressCardLeft}>
              <MapPinIcon width={17} height={17} />
              <View style={styles.addressCardText}>
                <View style={styles.addressTypeContainer}>
                  <Text style={styles.addressType}>{deliveryAddressTitle || 'Home'}</Text>
                </View>
                <Text style={styles.addressText} numberOfLines={1}>
                  {deliveryAddress || 'Select delivery address'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.changeButton}
              onPress={handleChangeAddressPress}
              activeOpacity={0.7}
            >
              <Text style={styles.changeButtonText}>Change</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.paymentSection}>
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentLabel}>TO PAY :</Text>
            <Text style={styles.paymentAmount}>₹{billSummary.totalBill.toFixed(0)}</Text>
          </View>
          <Animated.View style={{ transform: [{ scale: paymentButtonScale }] }}>
            <TouchableOpacity
              style={[styles.paymentButton, isPayNowLoading && styles.paymentButtonDisabled]}
              onPress={handlePayNow}
              activeOpacity={1}
              disabled={isPayNowLoading}
            >
              {isPayNowLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.paymentButtonText}>Pay Now</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
      )}

      {/* Custom Tip Modal */}
      <Modal
        visible={showCustomTipModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelCustomTip}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={handleCancelCustomTip}
          >
            <TouchableOpacity
              style={styles.customTipModal}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.customTipModalContent}>
                <View style={styles.customTipModalTextContainer}>
                  <Text style={styles.customTipModalTitle}>Delivery Partner Tip</Text>
                  <Text style={styles.customTipModalDescription}>
                    This amount goes to your delivery partner.
                  </Text>
                </View>

                <View style={styles.customTipInputContainer}>
                  <Text style={styles.customTipInputLabel}>Enter the amount</Text>
                  <View style={styles.customTipInputWrapper}>
                    <RupeeIcon width={9} height={12} />
                    <TextInput
                      style={styles.customTipInput}
                      placeholder="50"
                      placeholderTextColor="#666666"
                      value={customTipAmount}
                      onChangeText={setCustomTipAmount}
                      keyboardType="numeric"
                      autoFocus
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.customTipApplyButton}
                  onPress={handleApplyCustomTip}
                  activeOpacity={0.7}
                  disabled={!customTipAmount || isNaN(parseFloat(customTipAmount)) || parseFloat(customTipAmount) < 0}
                >
                  <Text style={styles.customTipApplyButtonText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  /** Default: no flexGrow — avoids a tall empty band above the footer when content is shorter than the screen. */
  scrollContent: {},
  /** Empty cart: grow content so the empty state can use vertical space like before. */
  scrollContentEmpty: {
    flexGrow: 1,
  },
  productListContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 12,
  },
  couponsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  couponsContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  couponsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  couponsText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4C4C4C',
    lineHeight: 20,
  },
  appliedCouponSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  appliedCouponContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  appliedCouponLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  appliedCouponTextContainer: {
    flexDirection: 'column',
    gap: 0,
    flex: 1,
  },
  appliedCouponSavingsText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4C4C4C',
    lineHeight: 20, // 1.4285714285714286em
  },
  appliedCouponCodeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3F723F',
    lineHeight: 18, // 1.5em
    fontFamily: 'Poppins', // Note: Poppins may not be available, will use system default
  },
  removeCouponButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  removeCouponButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D7263D',
    lineHeight: 20, // 1.6666666666666667em
  },
  cartItemWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
  },
  couponContainer: {
    gap: 12,
    marginBottom: 8,
  },
  nudgeBanner: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  nudgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  nudgeText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '500',
  },
  nudgeApplyButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  nudgeApplyText: {
    fontSize: 12,
    color: '#034703',
    fontWeight: '700',
  },
  couponInputWrapper: {
    gap: 8,
  },
  couponInputContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D1D1',
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    height: 48,
  },
  couponInput: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
    padding: 0,
  },
  applyButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  applyButtonDisabled: {
    opacity: 0.5,
  },
  applyButtonText: {
    color: '#034703',
    fontWeight: '700',
    fontSize: 14,
  },
  couponSuccessBanner: {
    backgroundColor: '#E8F5E9',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  couponSuccessText: {
    color: '#2E7D32',
    fontSize: 12,
    fontWeight: '600',
  },
  couponCashbackText: {
    color: '#2E7D32',
    fontSize: 11,
    marginTop: 2,
  },
  couponErrorBanner: {
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  couponErrorText: {
    color: '#C62828',
    fontSize: 12,
    fontWeight: '500',
  },
  viewCouponsLink: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  viewCouponsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewCouponsText: {
    color: '#034703',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    alignSelf: 'stretch',
  },
  emptyCartImageContainer: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCartImage: {
    width: 224,
    height: 224,
    opacity: 0.9,
  },
  emptyCartTitle: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: '#1A1A1A',
    textAlign: 'center',
    paddingHorizontal: 0,
  },
  emptyCartSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: '#6B6B6B',
    textAlign: 'center',
    width: 325,
  },
  emptyCartWarningCard: {
    width: 325,
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFC9C9',
    backgroundColor: '#FEF2F2', // Light gradient approximation
  },
  emptyCartWarningContent: {
    flexDirection: 'row',
    gap: 10.5,
    alignItems: 'flex-start',
  },
  emptyCartWarningIconContainer: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCartWarningIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCartWarningIcon: {
    fontSize: 14,
    color: '#E7000B',
  },
  emptyCartWarningTextContainer: {
    flex: 1,
    gap: 3.5,
  },
  emptyCartWarningTitle: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    color: '#1A1A1A',
    marginBottom: 3.5,
  },
  emptyCartWarningDescription: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    color: '#6B6B6B',
  },
  emptyCartButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 16, // Reduced padding to allow text in one line
    backgroundColor: '#034703',
    borderRadius: 8,
    minHeight: 48,
  },
  emptyCartButtonText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 22.4,
    color: '#FFFFFF',
    textAlign: 'center',
    flexShrink: 0, // Prevent text wrapping
  },
  tipSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    alignSelf: 'stretch',
  },
  tipContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  tipInfo: {
    flex: 1,
    flexDirection: 'column',
    gap: 12,
  },
  tipTextContainer: {
    flexDirection: 'column',
    alignSelf: 'stretch',
    gap: 0,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 20, // 1.4285714285714286em
  },
  tipDescription: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 18, // 1.5em
  },
  tipOptionsContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 8,
  },
  tipButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D1D1',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tipButtonMedium: {
    width: 61,
  },
  tipButtonSelected: {
    borderColor: '#034703',
    backgroundColor: '#F5F5F5',
  },
  tipButtonCustom: {
    width: 72,
    flexDirection: 'column',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tipButtonCustomContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    gap: 4,
  },
  tipButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 37,
  },
  tipButtonContentMedium: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 39,
  },
  tipButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1A1A1A',
    lineHeight: 16, // 1.3333333333333333em
    flexShrink: 0,
    textAlign: 'left',
  },
  tipImageContainer: {
    width: 76,
    height: 122,
    borderRadius: 10.5,
    overflow: 'hidden',
  },
  tipImage: {
    width: '100%',
    height: '100%',
  },
  billSummaryWrapper: {
    width: '100%',
  },
  deliveryInstructionsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  deliveryInstructionsContent: {
    flexDirection: 'column',
    gap: 12,
  },
  deliveryInstructionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deliveryInstructionsTextContainer: {
    flexDirection: 'column',
    gap: 0,
  },
  deliveryInstructionsTitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 20, // 1.4285714285714286em
  },
  deliveryInstructionsDescription: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 18, // 1.5em
  },
  deliveryInstructionsButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 11,
  },
  deliveryInstructionButton: {
    width: 100.67,
    height: 104,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'column',
    alignItems: 'center',
  },
  deliveryInstructionButtonEnabled: {
    backgroundColor: '#E0F2F1',
    gap: 16,
  },
  deliveryInstructionButtonDisabled: {
    backgroundColor: '#F5F5F5',
    gap: 20,
  },
  deliveryInstructionIconContainer: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    alignSelf: 'center',
  },
  deliveryInstructionIconContainerNoContact: {
    width: 77,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    alignSelf: 'center',
  },
  deliveryInstructionCheckmark: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#034703',
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryInstructionCheckmarkText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#034703',
    lineHeight: 14,
  },
  deliveryInstructionButtonText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 19.2, // 1.6000000635782878em
    textAlign: 'center',
  },
  additionalInstructionsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  additionalInstructionsContent: {
    flexDirection: 'column',
    gap: 8,
  },
  additionalInstructionsTextContainer: {
    flexDirection: 'column',
    gap: 0,
  },
  additionalInstructionsTitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 20,
  },
  additionalInstructionsDescription: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 18,
  },
  additionalInstructionsInput: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#D4D4D4',
    borderRadius: 3.5,
    paddingVertical: 11,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 22.4, // 1.5999999727521623em
    minHeight: 44,
    textAlignVertical: 'top',
  },
  bottomSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 27,
    elevation: 5,
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    borderRadius: 12,
    zIndex: 10,
  },
  addressCard: {
    marginBottom: 12,
  },
  addressCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 69,
  },
  addressCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  addressCardText: {
    flex: 1,
    gap: 0,
  },
  addressTypeContainer: {
    marginBottom: 0,
  },
  addressType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4C4C4C',
    lineHeight: 20,
  },
  addressText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#4C4C4C',
    lineHeight: 18,
  },
  changeButton: {
    paddingVertical: 0,
  },
  changeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3F723F',
    lineHeight: 20,
  },
  paymentSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 35,
  },
  paymentInfo: {
    gap: 10,
  },
  paymentLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4C4C4C',
    lineHeight: 20,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  paymentAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3F723F',
    lineHeight: 28,
    textAlign: 'center',
  },
  paymentButton: {
    backgroundColor: '#034703',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentButtonDisabled: {
    opacity: 0.65,
  },
  customerSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    alignSelf: 'stretch',
  },
  customerSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  customerSectionHint: {
    fontSize: 12,
    color: '#6B6B6B',
    marginBottom: 4,
  },
  customerFieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4C4C4C',
    marginTop: 4,
  },
  customerInput: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#D4D4D4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: '#1A1A1A',
  },
  saveContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingVertical: 4,
  },
  saveContactCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#034703',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveContactCheckboxChecked: {
    backgroundColor: '#034703',
  },
  saveContactCheckmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  saveContactLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    color: '#4C4C4C',
    lineHeight: 18,
  },
  paymentInitErrorBanner: {
    marginTop: 8,
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  paymentInitErrorText: {
    color: '#C62828',
    fontSize: 12,
    fontWeight: '500',
  },
  paymentButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  customTipModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    width: 349,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  customTipModalContent: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 16,
  },
  customTipModalTextContainer: {
    flexDirection: 'column',
    alignSelf: 'stretch',
    gap: 0,
  },
  customTipModalTitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 20, // 1.4285714285714286em
  },
  customTipModalDescription: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 18, // 1.5em
  },
  customTipInputContainer: {
    flexDirection: 'column',
    alignSelf: 'stretch',
    gap: 4,
  },
  customTipInputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1A1A1A',
    lineHeight: 18, // 1.5em
  },
  customTipInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 4,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#D4D4D4',
    borderRadius: 3.5,
    paddingTop: 11,
    paddingBottom: 11,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  customTipInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '400',
    color: '#666666',
    lineHeight: 16, // 1.3333333333333333em
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    margin: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  customTipApplyButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#034703',
    borderRadius: 8,
  },
  customTipApplyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 24, // 1.7142857142857142em
  },
  bottomNavigationContainer: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 0,
    backgroundColor: '#F5F5F5',
  },
});

export default Checkout;
