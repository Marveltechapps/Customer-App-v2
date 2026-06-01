import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../components/layout/Header';
import { useCart } from '@/contexts/CartContext';
import { cancelOrder, createOrder } from '../services/orders/orderService';
import { addressService } from '../services/address/addressService';
import { paymentService, type SavedCard } from '../services/payments/paymentService';
import { api } from '../services/api/client';
import { endpoints } from '../services/api/endpoints';
import { logger } from '@/utils/logger';
import { couponService } from '../services/coupons/couponService';
import { useLocation } from '../contexts/LocationContext';
import { useUser } from '../contexts/UserContext';
import { useAppConfig } from '../contexts/AppConfigContext';
import type { RootStackNavigationProp, RootStackParamList } from '../types/navigation';
import type { RouteProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IN_FLIGHT_PAYMENT_KEY, namespacedKey } from '../utils/storage';
import StandalonePaymentFlow from './StandalonePaymentFlow';
import {
  createWorldlineSession,
  openWorldlineGateway,
  completeWorldlinePayment,
  buildWorldlineCompletePayload,
  getWorldlineStatus,
  pollWorldlineStatus,
  type WorldlinePaymentStatus,
} from '../services/payments/worldlineCheckout';

type PaymentMethodOption = 'wallet' | 'cash' | 'card' | 'upi';
type PaymentUiState = 'idle' | 'creating_order' | 'opening_gateway' | 'verifying' | 'paid' | 'failed' | 'pending_verification' | 'unknown' | 'error';

const Payment: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'Payment'>>();
  const insets = useSafeAreaInsets();
  const { appConfig } = useAppConfig();
  const { cartItems, clearCart, refreshCart } = useCart();
  const { location: contextLocation } = useLocation();
  const { user, userKey } = useUser();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodOption>('cash');
  const [paymentUiState, setPaymentUiState] = useState<PaymentUiState>('idle');
  const [paymentStatus, setPaymentStatus] = useState<WorldlinePaymentStatus | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [cancellingPayment, setCancellingPayment] = useState(false);

  const [addressId, setAddressId] = useState<string | null>(null);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [loadingCards, setLoadingCards] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [cardForm, setCardForm] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletLoading, setWalletLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  const placeOrderScale = useRef(new Animated.Value(1)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const routeParams = route.params;
  const totalBill = routeParams?.totalBill ?? 0;
  const itemCount = routeParams?.itemCount ?? cartItems.length;
  const deliveryTip = routeParams?.deliveryTip ?? 0;
  const appliedCoupon = routeParams?.appliedCoupon;
  const routeAddressId = routeParams?.addressId ?? null;

  const useWallet = selectedMethod === 'wallet';
  const walletDeduction = useWallet ? Math.min(walletBalance, totalBill) : 0;
  const amountToPay = Math.max(totalBill - walletDeduction, 0);
  const cardProcessing = paymentUiState === 'opening_gateway' && selectedMethod === 'card';

  const paymentMethods: { id: PaymentMethodOption; label: string; description: string }[] = (() => {
    const DEFAULTS: Record<PaymentMethodOption, { label: string; description: string; order: number }> = {
      cash: { label: 'Cash on Delivery', description: 'Pay when your order arrives', order: 0 },
      wallet: {
        label: 'Wallet',
        description: walletLoading ? 'Loading wallet balance...' : `Available balance: ₹${walletBalance.toFixed(0)}`,
        order: 1,
      },
      card: { label: 'Credit / Debit Card', description: 'Pay securely via Worldline', order: 2 },
      upi: { label: 'UPI', description: 'Google Pay, PhonePe, Paytm', order: 3 },
    };

    const supported = new Set<PaymentMethodOption>(['cash', 'wallet', 'card', 'upi']);
    const configList = (appConfig?.paymentMethods ?? []).filter((m) => supported.has(m.key as PaymentMethodOption));

    // If config is absent/empty, fall back to safe defaults (includes UPI).
    if (configList.length === 0) {
      return (Object.keys(DEFAULTS) as PaymentMethodOption[])
        .sort((a, b) => DEFAULTS[a].order - DEFAULTS[b].order)
        .map((id) => ({ id, ...DEFAULTS[id] }));
    }

    // Use config ordering/labels, but keep wallet description dynamic.
    return configList
      .filter((m) => m.isActive !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((m) => {
        const id = m.key as PaymentMethodOption;
        const fallback = DEFAULTS[id];
        const label = (m.label || fallback.label).trim();
        const description =
          id === 'wallet'
            ? DEFAULTS.wallet.description
            : (m.description || fallback.description).trim();
        return { id, label, description };
      });
  })();

  const inFlightKey = namespacedKey(IN_FLIGHT_PAYMENT_KEY, userKey);

  const checkInFlightPayment = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(inFlightKey);
      if (stored) {
        const { orderId, method } = JSON.parse(stored);
        if (orderId) {
          setActiveOrderId(orderId);
          setSelectedMethod(method);
          setPaymentUiState('verifying');
          const status = await pollWorldlineStatus(orderId, (s) => setPaymentStatus(s), 6);
          handleVerificationResult(status);
        }
      }
    } catch (err) {
      logger.warn('Failed to check in-flight payment', err);
      // Avoid getting stuck on the overlay if status lookup fails.
      setPaymentUiState('pending_verification');
    }
  }, [inFlightKey]);

  useEffect(() => {
    checkInFlightPayment();
  }, [checkInFlightPayment]);

  const clearInFlightPaymentFn = async () => {
    await AsyncStorage.removeItem(inFlightKey);
  };

  /** Order id for pending/unknown flows may live only on last status payload or AsyncStorage if state desyncs. */
  const resolvePendingOrderIdAsync = useCallback(async (): Promise<string | null> => {
    const fromState = (activeOrderId || paymentStatus?.orderId || '').trim();
    if (fromState) return fromState;
    try {
      const stored = await AsyncStorage.getItem(inFlightKey);
      if (stored) {
        const parsed = JSON.parse(stored) as { orderId?: string };
        const id = parsed?.orderId != null ? String(parsed.orderId).trim() : '';
        if (id) return id;
      }
    } catch (e) {
      logger.warn('resolvePendingOrderIdAsync: storage read failed', e);
    }
    return null;
  }, [activeOrderId, paymentStatus?.orderId, inFlightKey]);

  const saveInFlightPayment = async (orderId: string, method: string) => {
    await AsyncStorage.setItem(inFlightKey, JSON.stringify({ orderId, method, startedAt: new Date().toISOString() }));
  };


  // ... (saved cards and wallet state kept same for now) ...


  useEffect(() => {
    if (!routeAddressId) {
      const fetchAddress = async () => {
        try {
          const res = await addressService.getDefault();
          if (res.success && res.data?._id) {
            setAddressId(res.data._id);
          }
        } catch {
          logger.warn('Failed to fetch default address');
        }
      };
      fetchAddress();
    }
  }, [routeAddressId]);

  useEffect(() => {
    const fetchWallet = async () => {
      setWalletLoading(true);
      try {
        const res = await api.get<any>(endpoints.wallet.balance);
        if (res.success && res.data) {
          setWalletBalance(res.data.balance || 0);
        }
      } catch {
        logger.warn('Failed to fetch wallet balance');
      } finally {
        setWalletLoading(false);
      }
    };
    fetchWallet();
  }, []);

  const fetchSavedCards = useCallback(async () => {
    setLoadingCards(true);
    try {
      const res = await paymentService.getSavedMethods();
      if (res.success && res.data) {
        const cards = res.data.filter((m) => m.type === 'card');
        setSavedCards(cards);
        const defaultCard = cards.find((c) => c.isDefault);
        if (defaultCard) setSelectedCardId(defaultCard.id);
      }
    } catch {
      logger.warn('Failed to fetch saved cards');
    } finally {
      setLoadingCards(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedCards();
  }, [fetchSavedCards]);

  const formatCardNumber = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const handleAddCard = async () => {
    const num = cardForm.number.replace(/\s/g, '');
    if (num.length < 15) {
      Alert.alert('Invalid Card', 'Please enter a valid card number.');
      return;
    }
    const [mm, yy] = cardForm.expiry.split('/');
    if (!mm || !yy || parseInt(mm, 10) < 1 || parseInt(mm, 10) > 12) {
      Alert.alert('Invalid Expiry', 'Please enter a valid expiry date (MM/YY).');
      return;
    }
    if (cardForm.cvv.length < 3) {
      Alert.alert('Invalid CVV', 'Please enter a valid CVV.');
      return;
    }
    if (cardForm.name.trim().length < 2) {
      Alert.alert('Invalid Name', 'Please enter the cardholder name.');
      return;
    }

    setSavingCard(true);
    try {
      const res = await paymentService.addMethod({
        type: 'card',
        cardNumber: num,
        expiryMonth: mm,
        expiryYear: yy,
        cardholderName: cardForm.name.trim(),
      });
      if (res.success && res.data) {
        setSavedCards((prev) => [...prev, res.data!]);
        setSelectedCardId(res.data.id);
        setShowAddCard(false);
        setCardForm({ number: '', expiry: '', cvv: '', name: '' });
      } else {
        Alert.alert('Error', 'Failed to save card. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Failed to save card. Please try again.');
    } finally {
      setSavingCard(false);
    }
  };

  const handleDeleteCard = (card: SavedCard) => {
    Alert.alert('Remove Card', `Remove card ending in ${card.last4}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await paymentService.removeMethod(card.id);
            setSavedCards((prev) => prev.filter((c) => c.id !== card.id));
            if (selectedCardId === card.id) setSelectedCardId(null);
          } catch {
            Alert.alert('Error', 'Failed to remove card.');
          }
        },
      },
    ]);
  };

  const handlePlaceOrder = async () => {
    if (paymentUiState !== 'idle' && paymentUiState !== 'failed' && paymentUiState !== 'error') return;

    Animated.sequence([
      Animated.timing(placeOrderScale, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.spring(placeOrderScale, { toValue: 1, tension: 300, friction: 10, useNativeDriver: true }),
    ]).start();

    setPaymentUiState('creating_order');

    try {
      const orderItems = cartItems.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      }));

      const resolvedAddressId = addressId || routeAddressId;
      if (!resolvedAddressId) {
        Alert.alert('Address Required', 'Please select a delivery address before placing order.');
        setPaymentUiState('idle');
        return;
      }

      let paymentMethodId = '';
      if (selectedMethod === 'card') {
        paymentMethodId = selectedCardId || 'card_app';
      } else if (selectedMethod === 'upi') {
        paymentMethodId = 'upi_worldline';
      } else if (selectedMethod === 'wallet') {
        paymentMethodId = 'wallet';
      }

      const response = await createOrder({
        items: orderItems,
        addressId: resolvedAddressId,
        paymentMethodId,
        paymentMethodType: selectedMethod,
        couponCode: appliedCoupon?.code,
        deliveryTip,
      });

      if (!response.success || !response.data) {
        throw new Error('Failed to create order');
      }

      const orderId = response.data.id;
      setActiveOrderId(orderId);
      await saveInFlightPayment(orderId, selectedMethod);

      if (selectedMethod === 'card' || selectedMethod === 'upi') {
        await refreshCart();
      }

      // 1. Cash or Full Wallet Pay (No Gateway)
      if (selectedMethod === 'cash' || (selectedMethod === 'wallet' && amountToPay === 0)) {
        await finalizeOrder(orderId);
        return;
      }

      // 2. Online Payment (Card / UPI via Worldline Gateway)
      setPaymentUiState('opening_gateway');
      logger.info('Creating Worldline session', {
        orderId,
        paymentMode: selectedMethod === 'upi' ? 'UPI' : 'cards',
      });

      const session = await createWorldlineSession({
        orderId,
        consumerEmailId: user?.email,
        consumerMobileNo: user?.phoneNumber,
        paymentMode: selectedMethod === 'upi' ? 'UPI' : 'cards',
      });

      logger.info('Opening Worldline gateway', {
        txnId: session.txnId,
        paymentMode: selectedMethod,
        hashAlgo: session.hashAlgo,
      });
      
      const sdkResponse = await openWorldlineGateway(session.sessionPayload, { hashAlgo: session.hashAlgo });

      const sdkKeys =
        sdkResponse && typeof sdkResponse === 'object' && !Array.isArray(sdkResponse)
          ? Object.keys(sdkResponse as object)
          : [];
      logger.info('SDK returned response (all keys + merged payload for complete)', {
        txnId: session.txnId,
        sdkKeyCount: sdkKeys.length,
        sdkKeys,
        txn_status: (sdkResponse as any)?.txn_status,
      });

      const { response: mergedGatewayResponse, debug: sdkDebug } = buildWorldlineCompletePayload(sdkResponse);
      logger.info('Worldline complete payload prepared', {
        txnId: session.txnId,
        mergedKeyCount: Object.keys(mergedGatewayResponse).length,
        mergedKeys: Object.keys(mergedGatewayResponse),
        attachedClientDebug: !!sdkDebug,
      });

      setPaymentUiState('verifying');
      await completeWorldlinePayment({
        orderId,
        txnId: session.txnId,
        response: mergedGatewayResponse,
        ...(sdkDebug ? { debug: sdkDebug } : {}),
      });

      // Start polling for final status (more aggressive for immediate verification)
      logger.info('Starting payment status polling', { orderId });
      const finalStatus = await pollWorldlineStatus(orderId, (s) => setPaymentStatus(s), 8);
      handleVerificationResult(finalStatus);

    } catch (error: any) {
      logger.error('Payment flow failed', {
        error: error?.message,
        code: error?.code,
        orderId: activeOrderId,
      });
      setPaymentUiState('error');
      
      const errorMessage = error?.message || 'Something went wrong. Please check your connection and try again.';
      const isUserCancellation = errorMessage.toLowerCase().includes('cancel') || errorMessage.toLowerCase().includes('user');
      
      Alert.alert(
        isUserCancellation ? 'Payment Cancelled' : 'Payment Error',
        errorMessage,
        [
          { text: 'Go Back', style: 'cancel', onPress: () => navigation.goBack() },
          { text: 'Retry', onPress: () => setPaymentUiState('idle') },
        ]
      );
    }
  };

  const finalizeOrder = async (orderId: string) => {
    try {
      // Coupon redemption for card/UPI runs on backend after payment (releaseOrderFulfillment)
      if (appliedCoupon && selectedMethod !== 'card' && selectedMethod !== 'upi') {
        await couponService.redeemCoupon({
          coupon_code: appliedCoupon.code,
          user_id: userKey,
          order_id: orderId,
          cart_items: cartItems.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            price: item.price,
          })),
          cart_value: totalBill,
          payment_method: selectedMethod.toUpperCase(),
          zone: contextLocation?.area || '',
          delivery_fee: 0
        }).catch(err => logger.warn('Coupon redemption failed (non-blocking)', err));
      }

      if (walletDeduction > 0) {
        await api.post(endpoints.wallet.debit, {
          amount: walletDeduction,
          orderId,
        }).catch(err => logger.warn('Wallet debit failed (non-blocking)', err));
      }

      await clearCart();
      await clearInFlightPaymentFn();
      setPaymentUiState('paid');
      setOrderPlaced(true);

      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => {
          navigation.reset({
            index: 1,
            routes: [{ name: 'MainTabs' }, { name: 'OrderStatus' }],
          });
        }, 1500);
      });
    } catch (err) {
      logger.error('Finalize order failed', err);
      setPaymentUiState('error');
    }
  };

  const handleVerificationResult = (status: WorldlinePaymentStatus) => {
    if (status.orderId) {
      setActiveOrderId(status.orderId);
    }
    
    logger.info('Payment verification result', {
      orderId: status.orderId,
      uiState: status.uiState,
      paymentStatus: status.orderPaymentStatus,
      txnStatus: status.latestPayment?.status,
    });

    if (status.uiState === 'PAID') {
      finalizeOrder(status.orderId);
    } else if (status.uiState === 'FAILED' || status.uiState === 'RETRY_AVAILABLE') {
      clearInFlightPaymentFn();
      setPaymentUiState('failed');
      void refreshCart().catch(() => {});
      const payCode = String(status.latestPayment?.statusCode || '').trim();
      let alertTitle = 'Payment Failed';
      let failureReason =
        status.latestPayment?.statusMessage || 'Payment was declined by your bank or payment provider.';
      if (payCode === '0392') {
        alertTitle = 'Payment Cancelled';
        failureReason = status.latestPayment?.statusMessage || 'You cancelled the payment.';
      } else if (payCode === '0396') {
        alertTitle = 'Payment Declined';
        failureReason = status.latestPayment?.statusMessage || 'Your bank declined this payment.';
      }
      Alert.alert(alertTitle, failureReason, [
        { text: 'Go Back', style: 'cancel', onPress: () => navigation.goBack() },
        { text: 'Retry Payment', onPress: () => setPaymentUiState('idle') },
      ]);
    } else if (status.uiState === 'PENDING_VERIFICATION') {
      setPaymentUiState('pending_verification');
    } else if (status.uiState === 'UNKNOWN') {
      setPaymentUiState('unknown');
    } else {
      setPaymentUiState('unknown');
    }
  };

  const handleCancelPendingPayment = () => {
    if (cancellingPayment) return;

    void (async () => {
      const orderId = await resolvePendingOrderIdAsync();
      if (!orderId) {
        Alert.alert(
          'Cannot cancel',
          'We could not find this order. Go back to checkout, or check My Orders if you were charged.',
        );
        return;
      }

      Alert.alert(
        'Cancel Payment',
        'Do you want to cancel this payment attempt and return to checkout?',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes, Cancel',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  setCancellingPayment(true);
                  await cancelOrder(orderId);
                  await refreshCart();
                  await clearInFlightPaymentFn();
                  setPaymentStatus(null);
                  setActiveOrderId(null);
                  setPaymentUiState('idle');
                  setTimeout(() => {
                    Alert.alert('Payment Cancelled', 'Your pending payment has been cancelled.');
                  }, 0);
                } catch (err) {
                  logger.error('Failed to cancel pending payment', err);
                  setTimeout(() => {
                    Alert.alert(
                      'Unable to Cancel',
                      'We could not cancel this payment right now. Please try again.',
                    );
                  }, 0);
                } finally {
                  setCancellingPayment(false);
                }
              })();
            },
          },
        ],
      );
    })();
  };

  const handleRetryStatusCheck = async () => {
    const orderId = await resolvePendingOrderIdAsync();
    if (!orderId) {
      Alert.alert('Cannot retry', 'We could not find this order. Go back and try again.');
      return;
    }

    setPaymentUiState('verifying');
    try {
      const status = await pollWorldlineStatus(orderId, (s) => setPaymentStatus(s), 3);
      handleVerificationResult(status);
    } catch (err) {
      logger.error('Retry status check failed', err);
      setPaymentUiState('pending_verification');
      Alert.alert('Status Check Failed', 'Unable to refresh payment status right now. Please try again.');
    }
  };

  const standaloneSession = route.params?.standaloneSession;
  if (standaloneSession) {
    return <StandalonePaymentFlow standalone={standaloneSession} navigation={navigation} />;
  }

  if (cardProcessing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.processingContainer}>
          <View style={styles.processingIconCircle}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
          <Text style={styles.processingTitle}>Processing Payment</Text>
          <Text style={styles.processingSubtitle}>
            Please wait while we securely process your card payment...
          </Text>
          <Text style={styles.processingNote}>Do not close or go back</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (orderPlaced) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Animated.View style={[styles.successContainer, { opacity: successOpacity }]}>
          <View style={styles.successIconCircle}>
            <Text style={styles.successIcon}>✓</Text>
          </View>
          <Text style={styles.successTitle}>Order Placed!</Text>
          <Text style={styles.successSubtitle}>Your order has been placed successfully</Text>
          <Text style={styles.successRedirect}>Redirecting to order tracking...</Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

  const renderSavedCards = () => {
    if (selectedMethod !== 'card') return null;

    return (
      <View style={styles.expandedSection}>
        {loadingCards ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#034703" />
            <Text style={styles.loadingText}>Loading saved cards...</Text>
          </View>
        ) : (
          <>
            {savedCards.map((card) => (
              <TouchableOpacity
                key={card.id}
                style={[
                  styles.savedCardItem,
                  selectedCardId === card.id && styles.savedCardItemSelected,
                ]}
                onPress={() => setSelectedCardId(card.id)}
                activeOpacity={0.7}
              >
                <View style={styles.savedCardLeft}>
                  <View style={[styles.cardRadio, selectedCardId === card.id && styles.cardRadioSelected]}>
                    {selectedCardId === card.id && <View style={styles.cardRadioInner} />}
                  </View>
                  <View style={styles.savedCardInfo}>
                    <Text style={styles.savedCardBrand}>{card.brand || 'Card'}</Text>
                    <Text style={styles.savedCardNumber}>
                      **** **** **** {card.last4}
                    </Text>
                    {card.cardholderName ? (
                      <Text style={styles.savedCardHolder}>{card.cardholderName}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.savedCardActions}>
                  <TouchableOpacity
                    style={styles.cardActionBtn}
                    onPress={() => handleDeleteCard(card)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.cardActionDelete}>✕</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}

            {!showAddCard ? (
              <TouchableOpacity
                style={styles.addCardButton}
                onPress={() => setShowAddCard(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.addCardPlus}>+</Text>
                <Text style={styles.addCardText}>Add New Card</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.addCardForm}>
                <Text style={styles.addCardFormTitle}>Add New Card</Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Card Number</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="1234 5678 9012 3456"
                    placeholderTextColor="rgba(107, 107, 107, 0.5)"
                    value={cardForm.number}
                    onChangeText={(t) => setCardForm((f) => ({ ...f, number: formatCardNumber(t) }))}
                    keyboardType="number-pad"
                    maxLength={19}
                  />
                </View>
                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Expiry Date</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="MM/YY"
                      placeholderTextColor="rgba(107, 107, 107, 0.5)"
                      value={cardForm.expiry}
                      onChangeText={(t) => setCardForm((f) => ({ ...f, expiry: formatExpiry(t) }))}
                      keyboardType="number-pad"
                      maxLength={5}
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>CVV</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="123"
                      placeholderTextColor="rgba(107, 107, 107, 0.5)"
                      value={cardForm.cvv}
                      onChangeText={(t) => setCardForm((f) => ({ ...f, cvv: t.replace(/\D/g, '').slice(0, 4) }))}
                      keyboardType="number-pad"
                      maxLength={4}
                      secureTextEntry
                    />
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Cardholder Name</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="John Doe"
                    placeholderTextColor="rgba(107, 107, 107, 0.5)"
                    value={cardForm.name}
                    onChangeText={(t) => setCardForm((f) => ({ ...f, name: t }))}
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={styles.formCancelBtn}
                    onPress={() => {
                      setShowAddCard(false);
                      setCardForm({ number: '', expiry: '', cvv: '', name: '' });
                    }}
                  >
                    <Text style={styles.formCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.formSaveBtn, savingCard && styles.formSaveBtnDisabled]}
                    onPress={handleAddCard}
                    disabled={savingCard}
                  >
                    {savingCard ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.formSaveText}>Save Card</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  const renderWalletDetails = () => {
    if (selectedMethod !== 'wallet') return null;

    return (
      <View style={styles.expandedSection}>
        <View style={styles.walletDetailRow}>
          <Text style={styles.walletDetailLabel}>Order total</Text>
          <Text style={styles.walletDetailValue}>₹{totalBill.toFixed(0)}</Text>
        </View>
        <View style={styles.walletDetailRow}>
          <Text style={styles.walletDetailLabel}>Wallet deduction</Text>
          <Text style={[styles.walletDetailValue, { color: '#3F723F' }]}>-₹{walletDeduction.toFixed(0)}</Text>
        </View>
        {amountToPay > 0 ? (
          <>
            <View style={styles.walletDivider} />
            <View style={styles.walletDetailRow}>
              <Text style={[styles.walletDetailLabel, { fontWeight: '600' }]}>Remaining to pay</Text>
              <Text style={[styles.walletDetailValue, { fontWeight: '700' }]}>₹{amountToPay.toFixed(0)}</Text>
            </View>
            <Text style={styles.walletPartialNote}>
              Remaining ₹{amountToPay.toFixed(0)} will be collected as Cash on Delivery
            </Text>
          </>
        ) : (
          <>
            <View style={styles.walletDivider} />
            <View style={styles.walletFullCoverBadge}>
              <Text style={styles.walletFullCoverBadgeText}>✓ Wallet covers the full amount</Text>
            </View>
          </>
        )}
      </View>
    );
  };

  const renderUpiDetails = () => {
    if (selectedMethod !== 'upi') return null;

    return (
      <View style={styles.expandedSection}>
        <View style={styles.upiInfoBox}>
          <Text style={styles.upiInfoText}>
            You will be redirected to the secure Worldline payment gateway to complete your UPI transaction using any UPI app.
          </Text>
        </View>
      </View>
    );
  };

  const renderStatusOverlay = () => {
    if (paymentUiState === 'idle' || paymentUiState === 'paid') return null;

    let title = 'Processing...';
    let subtitle = 'Please wait';

    switch (paymentUiState) {
      case 'creating_order':
        title = 'Creating Order';
        break;
      case 'opening_gateway':
        title = 'Opening Payment Gateway';
        break;
      case 'verifying':
        title = 'Verifying Payment';
        subtitle = 'Checking status with your bank';
        break;
      case 'pending_verification':
        title = 'Payment Pending';
        subtitle = 'Bank is taking longer than usual to respond. We will keep checking.';
        break;
      case 'unknown':
        title = 'Status Unknown';
        subtitle = 'We could not verify the payment yet. Retry status check or cancel this payment attempt.';
        break;
    }

    return (
      <View style={styles.overlay}>
        <View style={styles.statusCard}>
          {paymentUiState === 'pending_verification' || paymentUiState === 'unknown' ? (
            <Text style={styles.pendingIcon}>!</Text>
          ) : (
            <ActivityIndicator size="large" color="#034703" />
          )}
          <Text style={styles.statusTitle}>{title}</Text>
          <Text style={styles.statusSubtitle}>{subtitle}</Text>
          {(paymentUiState === 'pending_verification' || paymentUiState === 'unknown') && (
            <>
              <TouchableOpacity
                style={[styles.retryBtn, cancellingPayment && styles.retryBtnDisabled]}
                onPress={handleRetryStatusCheck}
                disabled={cancellingPayment}
              >
                <Text style={styles.retryBtnText}>Retry Status Check</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.retryBtn, styles.cancelPaymentBtn, cancellingPayment && styles.retryBtnDisabled]}
                onPress={handleCancelPendingPayment}
                disabled={cancellingPayment}
              >
                {cancellingPayment ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.retryBtnText}>Cancel Payment</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header title="Payment" showBackButton onBackPress={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Order Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Order Total</Text>
              <Text style={styles.summaryAmount}>₹{totalBill.toFixed(0)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryMuted}>{itemCount} {itemCount === 1 ? 'item' : 'items'} in cart</Text>
              {appliedCoupon ? (
                <View style={styles.couponRow}>
                  <Text style={styles.couponDiscountLabel}>Coupon discount</Text>
                  <Text style={styles.couponDiscountValue}>-₹{appliedCoupon.discount}</Text>
                </View>
              ) : (
                <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'Cart' })}>
                  <Text style={styles.haveCouponLink}>Have a coupon code?</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Payment Method Selection */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Select Payment Method</Text>
          </View>

          {paymentMethods.map((method) => {
            const isSelected = selectedMethod === method.id;
            return (
              <View
                key={method.id}
                style={[
                  styles.methodWrapper,
                  isSelected && styles.methodWrapperSelected,
                ]}
              >
                <TouchableOpacity
                  style={styles.methodCard}
                  onPress={() => {
                    setSelectedMethod(method.id);
                  }}
                  activeOpacity={0.7}
                  disabled={paymentUiState !== 'idle' && paymentUiState !== 'failed'}
                >
                  <View style={styles.methodLeft}>
                    <View style={[styles.radio, isSelected && styles.radioSelected]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <View style={styles.methodInfo}>
                      <Text style={[styles.methodLabel, isSelected && styles.methodLabelSelected]}>
                        {method.label}
                      </Text>
                      <Text style={styles.methodDescription}>{method.description}</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {method.id === 'wallet' && isSelected && renderWalletDetails()}
                {method.id === 'card' && isSelected && renderSavedCards()}
                {method.id === 'upi' && isSelected && renderUpiDetails()}
              </View>
            );
          })}

          {/* Info note */}
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>🔒</Text>
            <Text style={styles.infoText}>
              {selectedMethod === 'wallet' && amountToPay === 0
                ? 'Full amount will be paid from your SelOrg Wallet.'
                : selectedMethod === 'wallet'
                ? `₹${walletDeduction.toFixed(0)} from wallet, ₹${amountToPay.toFixed(0)} as cash on delivery.`
                : selectedMethod === 'cash'
                ? 'You will pay the delivery partner in cash when your order arrives.'
                : 'Your payment will be processed securely. Amount will be charged upon order confirmation.'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Place Order Button */}
      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Animated.View style={{ transform: [{ scale: placeOrderScale }], width: '100%' }}>
          {(() => {
            const isDisabled = paymentUiState !== 'idle' && paymentUiState !== 'failed' && paymentUiState !== 'error';
            const buttonDisabled = isDisabled;

            let buttonLabel = `Place Order  •  ₹${totalBill.toFixed(0)}`;
            if (useWallet && walletDeduction > 0) {
              buttonLabel += ` (₹${walletDeduction.toFixed(0)} wallet)`;
            }

            return (
              <TouchableOpacity
                style={[
                  styles.placeOrderButton,
                  buttonDisabled && styles.placeOrderButtonDisabled,
                ]}
                onPress={handlePlaceOrder}
                activeOpacity={0.8}
                disabled={buttonDisabled}
              >
                {paymentUiState === 'creating_order' ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text style={styles.placeOrderText}>Placing Order...</Text>
                  </View>
                ) : (
                  <Text style={styles.placeOrderText}>{buttonLabel}</Text>
                )}
              </TouchableOpacity>
            );
          })()}
        </Animated.View>
      </View>
      {renderStatusOverlay()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 120,
    gap: 12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    width: '80%',
    gap: 16,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: '#034703',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  retryBtnDisabled: {
    opacity: 0.6,
  },
  cancelPaymentBtn: {
    backgroundColor: '#C62828',
  },
  pendingIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 28,
    lineHeight: 44,
    fontWeight: '700',
    color: '#C62828',
    backgroundColor: '#FDECEC',
    overflow: 'hidden',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 20,
  },
  summaryAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3F723F',
    lineHeight: 28,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#D1D1D1',
    marginVertical: 10,
  },
  summaryMuted: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 18,
  },
  couponBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3F723F',
    lineHeight: 18,
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  couponDiscountLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B6B6B',
  },
  couponDiscountValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00A85A',
  },
  haveCouponLink: {
    fontSize: 12,
    fontWeight: '600',
    color: '#034703',
    textDecorationLine: 'underline',
  },

  sectionHeader: {
    marginTop: 4,
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 20,
  },

  methodWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  methodWrapperSelected: {
    borderColor: '#034703',
    backgroundColor: 'rgba(3, 71, 3, 0.02)',
  },
  methodCard: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  methodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D1D1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#034703',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#034703',
  },
  methodInfo: {
    flex: 1,
    gap: 2,
  },
  methodLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    lineHeight: 20,
  },
  methodLabelSelected: {
    fontWeight: '600',
    color: '#034703',
  },
  methodDescription: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 18,
  },

  infoCard: {
    backgroundColor: '#E0F2F1',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '400',
    color: '#4C4C4C',
    lineHeight: 18,
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
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  placeOrderButton: {
    backgroundColor: '#034703',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeOrderButtonDisabled: {
    opacity: 0.6,
  },
  placeOrderText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  processingIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#175FBE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  processingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 30,
  },
  processingSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#4C4C4C',
    lineHeight: 20,
    textAlign: 'center',
  },
  processingNote: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B6B6B',
    lineHeight: 18,
    marginTop: 8,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#034703',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  successIcon: {
    fontSize: 40,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#034703',
    lineHeight: 32,
  },
  successSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#4C4C4C',
    lineHeight: 20,
    textAlign: 'center',
  },
  successRedirect: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 18,
    marginTop: 8,
  },

  expandedSection: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#D1D1D1',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 18,
  },

  savedCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: 8,
    backgroundColor: '#F5F5F5',
  },
  savedCardItemSelected: {
    borderColor: '#034703',
    backgroundColor: 'rgba(3, 71, 3, 0.02)',
  },
  savedCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cardRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#D1D1D1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardRadioSelected: {
    borderColor: '#034703',
  },
  cardRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#034703',
  },
  savedCardInfo: {
    flex: 1,
    gap: 2,
  },
  savedCardBrand: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    lineHeight: 20,
  },
  savedCardNumber: {
    fontSize: 12,
    fontWeight: '400',
    color: '#4C4C4C',
    lineHeight: 18,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  savedCardHolder: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 18,
  },
  savedCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardActionDelete: {
    fontSize: 12,
    color: '#D7263D',
    fontWeight: '700',
  },

  addCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#034703',
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addCardPlus: {
    fontSize: 16,
    fontWeight: '500',
    color: '#034703',
  },
  addCardText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#034703',
    lineHeight: 18,
  },
  addCardForm: {
    marginTop: 8,
    gap: 12,
  },
  addCardFormTitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 20,
    marginBottom: 2,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1A1A1A',
    lineHeight: 18,
  },
  textInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 3.5,
    borderWidth: 1,
    borderColor: '#D4D4D4',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 12,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  formCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D1D1',
    alignItems: 'center',
  },
  formCancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B6B6B',
    lineHeight: 20,
  },
  formSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#034703',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formSaveBtnDisabled: {
    opacity: 0.6,
  },
  formSaveText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 20,
  },

  upiInfoBox: {
    marginTop: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  upiInfoText: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 18,
    textAlign: 'center',
  },

  walletDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  walletDetailLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 18,
  },
  walletDetailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    lineHeight: 20,
  },
  walletDivider: {
    height: 1,
    backgroundColor: '#D1D1D1',
    marginVertical: 8,
  },
  walletPartialNote: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 18,
    marginTop: 6,
  },
  walletFullCoverBadge: {
    backgroundColor: '#E0F2F1',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  walletFullCoverBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#034703',
    lineHeight: 18,
  },
});

export default Payment;
