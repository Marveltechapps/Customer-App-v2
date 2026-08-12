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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import Header from '../components/layout/Header';
import { useCart } from '@/contexts/CartContext';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { cancelOrder, createOrder } from '../services/orders/orderService';
import { addressService } from '../services/address/addressService';
import { subscribeAddressesChanged } from '../utils/addressRefresh';
import { logger } from '@/utils/logger';
import { couponService } from '../services/coupons/couponService';
import { useLocation } from '../contexts/LocationContext';
import { useUser } from '../contexts/UserContext';
import type { RootStackNavigationProp, RootStackParamList } from '../types/navigation';
import type { RouteProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IN_FLIGHT_PAYMENT_KEY, namespacedKey } from '../utils/storage';
import StandalonePaymentFlow from './StandalonePaymentFlow';
import { api } from '../services/api/client';
import { endpoints } from '../services/api/endpoints';
import {
  createWorldlineSession,
  openWorldlineGateway,
  completeWorldlinePayment,
  buildWorldlineCompletePayload,
  getWorldlineStatus,
  pollWorldlineStatus,
  type WorldlinePaymentStatus,
} from '../services/payments/worldlineCheckout';
import {
  abortWorldlinePayment,
  fetchPaymentRetryStatus,
  preparePaymentRetry,
  recordPaymentFailure,
} from '../services/payments/paymentRetryService';

type CheckoutMethodKind = 'cash' | 'digital' | 'wallet';
type PaymentUiState = 'idle' | 'creating_order' | 'opening_gateway' | 'verifying' | 'paid' | 'failed' | 'pending_verification' | 'unknown' | 'error';

type ResolvedCheckoutMethod = {
  key: string;
  kind: CheckoutMethodKind;
  label: string;
  description: string;
  disabled?: boolean;
  disabledReason?: string;
};

function resolveCheckoutMethodKind(key: string): CheckoutMethodKind {
  const k = String(key || '').toLowerCase();
  if (k === 'cash' || k === 'cod') return 'cash';
  if (k === 'wallet' || k === 'selorg_wallet') return 'wallet';
  return 'digital';
}

function toOrderPaymentMethodType(kind: CheckoutMethodKind): 'cash' | 'digital' | 'wallet' {
  if (kind === 'cash') return 'cash';
  if (kind === 'wallet') return 'wallet';
  return 'digital';
}

function resolveInitialPaymentMethod(
  value: string | undefined,
): string {
  if (!value) return '';
  const v = String(value).toLowerCase();
  if (v === 'cash' || v === 'cod') return 'cash';
  if (v === 'wallet' || v === 'selorg_wallet') return 'wallet';
  if (v === 'digital' || v === 'card' || v === 'upi') return 'digital';
  return v;
}

function formatInr(amount: number): string {
  return `₹${(Math.round((Number(amount) || 0) * 100) / 100).toFixed(0)}`;
}

const Payment: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'Payment'>>();
  const routeParams = route.params;
  const insets = useSafeAreaInsets();
  const { cartItems, clearCart, refreshCart, releaseEmptyCartLock } = useCart();
  const { location: contextLocation } = useLocation();
  const { user, userKey } = useUser();
  const { appConfig } = useAppConfig();

  const [selectedMethodKey, setSelectedMethodKey] = useState<string>(() =>
    resolveInitialPaymentMethod(
      (routeParams as { initialPaymentMethod?: string } | undefined)?.initialPaymentMethod,
    ),
  );
  const [walletBalance, setWalletBalance] = useState(0);
  const [paymentUiState, setPaymentUiState] = useState<PaymentUiState>('idle');
  const [paymentStatus, setPaymentStatus] = useState<WorldlinePaymentStatus | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [cancellingPayment, setCancellingPayment] = useState(false);

  const [addressId, setAddressId] = useState<string | null>(null);
  const [orderPlaced, setOrderPlaced] = useState(false);

  const placeOrderScale = useRef(new Animated.Value(1)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const totalBill = routeParams?.totalBill ?? 0;
  const itemCount = routeParams?.itemCount ?? cartItems.length;
  const deliveryTip = routeParams?.deliveryTip ?? 0;
  const appliedCoupon = routeParams?.appliedCoupon;
  const routeAddressId = routeParams?.addressId ?? null;
  const autoStartGateway = routeParams?.autoStartGateway === true;
  const routeCustomerName = routeParams?.customerName ?? undefined;
  const routeCustomerEmail = routeParams?.customerEmail ?? undefined;
  const routeCustomerPhone = routeParams?.customerPhone ?? undefined;
  /** Existing unpaid order — resume / retry payment (from Order Status banner). */
  const resumeOrderId = String(routeParams?.orderId ?? '').trim() || null;
  const autoStartGatewayRef = useRef(false);
  const handlePlaceOrderRef = useRef<(() => Promise<void>) | null>(null);
  const lastTxnIdRef = useRef<string | null>(null);

  const walletEnabled = appConfig?.featureFlags?.enableWallet !== false;

  const checkoutMethods = React.useMemo((): ResolvedCheckoutMethod[] => {
        const fromApi = (Array.isArray(appConfig?.paymentMethods) ? appConfig.paymentMethods : [])
      .filter((m) => m.isActive)
      .filter((m) => {
        const kind = resolveCheckoutMethodKind(m.key);
        if (kind === 'wallet') return walletEnabled;
        return true;
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const base: ResolvedCheckoutMethod[] =
      fromApi.length > 0
        ? fromApi.map((m): ResolvedCheckoutMethod => ({
            key: m.key,
            kind: resolveCheckoutMethodKind(m.key),
            label: m.label,
            description: m.description,
          }))
        : (
            [
              {
                key: 'wallet',
                kind: 'wallet' as const,
                label: 'Selorg Wallet',
                description: 'Pay with your Selorg Wallet balance',
              },
              {
                key: 'digital',
                kind: 'digital' as const,
                label: 'Digital Payment',
                description: 'Card, UPI, net banking via secure payment',
              },
              {
                key: 'cash',
                kind: 'cash' as const,
                label: 'Cash on Delivery',
                description: 'Pay when your order arrives',
              },
            ] as ResolvedCheckoutMethod[]
          ).filter((m) => (m.kind === 'wallet' ? walletEnabled : true));

    return base.map((m) => {
      if (m.kind !== 'wallet') return { ...m, disabled: false };
      if (!(walletBalance > 0)) {
        return {
          ...m,
          description: 'No balance available — add money in Profile → Wallet',
          disabled: true,
          disabledReason: 'Insufficient wallet balance',
        };
      }
      if (totalBill > 0 && walletBalance >= totalBill) {
        return {
          ...m,
          description: `Available ${formatInr(walletBalance)} · Pays this order in full`,
          disabled: false,
        };
      }
      if (totalBill > 0) {
        const remaining = Math.max(0, Math.round((totalBill - walletBalance) * 100) / 100);
        return {
          ...m,
          description: `Use ${formatInr(walletBalance)}, then pay ${formatInr(remaining)} online`,
          disabled: false,
        };
      }
      return {
        ...m,
        description: `Available balance ${formatInr(walletBalance)}`,
        disabled: false,
      };
    });
  }, [appConfig?.paymentMethods, walletEnabled, walletBalance, totalBill]);

  const selectedMethod =
    checkoutMethods.find((m) => m.key === selectedMethodKey) ||
    checkoutMethods.find((m) => m.kind === resolveCheckoutMethodKind(selectedMethodKey)) ||
    checkoutMethods[0] ||
    null;
  const selectedKind: CheckoutMethodKind = selectedMethod?.kind || 'cash';

  useEffect(() => {
    if (!selectedMethodKey && checkoutMethods.length > 0) {
      setSelectedMethodKey(checkoutMethods[0].key);
      return;
    }
    if (
      selectedMethodKey &&
      checkoutMethods.length > 0 &&
      !checkoutMethods.some((m) => m.key === selectedMethodKey)
    ) {
      const byKind = checkoutMethods.find(
        (m) => m.kind === resolveCheckoutMethodKind(selectedMethodKey),
      );
      setSelectedMethodKey(byKind?.key || checkoutMethods[0].key);
    }
  }, [checkoutMethods, selectedMethodKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ balance?: number; data?: { balance?: number } }>(
          endpoints.wallet.balance,
        );
        const balance = Number((res as any)?.data?.balance ?? (res as any)?.balance ?? 0);
        if (!cancelled) setWalletBalance(Number.isFinite(balance) ? balance : 0);
      } catch (err) {
        logger.warn('Failed to load wallet balance for checkout', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userKey]);

  const gatewayProcessing =
    paymentUiState === 'opening_gateway' &&
    (selectedKind === 'digital' || selectedKind === 'wallet');

  const inFlightKey = namespacedKey(IN_FLIGHT_PAYMENT_KEY, userKey);

  const checkInFlightPayment = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(inFlightKey);
      if (stored) {
        const { orderId, method } = JSON.parse(stored);
        if (orderId) {
          setActiveOrderId(orderId);
          setSelectedMethodKey(
            method === 'cash' ? 'cash' : method === 'wallet' ? 'wallet' : 'digital',
          );
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


  const fetchDefaultAddressId = useCallback(async () => {
    if (routeAddressId) {
      setAddressId(routeAddressId);
      return;
    }
    try {
      const res = await addressService.getDefault();
      if (res.success && res.data?._id) {
        setAddressId(res.data._id);
      }
    } catch {
      logger.warn('Failed to fetch default address');
    }
  }, [routeAddressId]);

  useEffect(() => {
    void fetchDefaultAddressId();
  }, [fetchDefaultAddressId]);

  useRefreshOnFocus(() => {
    void fetchDefaultAddressId();
  }, [fetchDefaultAddressId]);

  useEffect(() => {
    if (routeAddressId) {
      return;
    }
    return subscribeAddressesChanged(() => {
      void fetchDefaultAddressId();
    });
  }, [fetchDefaultAddressId, routeAddressId]);

  const handlePlaceOrder = async () => {
    if (paymentUiState !== 'idle' && paymentUiState !== 'failed' && paymentUiState !== 'error') return;
    if (!selectedMethod) {
      Alert.alert('Payment Method', 'Please select a payment method.');
      return;
    }
    if (selectedMethod.disabled) {
      Alert.alert('Wallet Unavailable', selectedMethod.disabledReason || 'This payment method is unavailable.');
      return;
    }

    Animated.sequence([
      Animated.timing(placeOrderScale, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.spring(placeOrderScale, { toValue: 1, tension: 300, friction: 10, useNativeDriver: true }),
    ]).start();

    try {
      // Resume unpaid order — skip createOrder; open Worldline for remaining amount.
      const existingOrderId = resumeOrderId || activeOrderId;
      if (existingOrderId && (selectedKind === 'digital' || selectedKind === 'wallet')) {
        setPaymentUiState('creating_order');
        const retryStatus = await fetchPaymentRetryStatus(existingOrderId).catch(() => null);
        if (retryStatus && !retryStatus.canRetry) {
          throw new Error(
            retryStatus.reason || 'This payment cannot be retried. Please place a new order.'
          );
        }
        await preparePaymentRetry(existingOrderId, { paymentMode: 'all' }).catch(() => undefined);

        setActiveOrderId(existingOrderId);
        await saveInFlightPayment(existingOrderId, selectedKind);
        setPaymentUiState('opening_gateway');

        const session = await createWorldlineSession({
          orderId: existingOrderId,
          consumerEmailId: routeCustomerEmail || user?.email,
          consumerMobileNo: routeCustomerPhone || user?.phoneNumber,
          paymentMode: 'all',
        });
        lastTxnIdRef.current = session.txnId;

        const sdkResponse = await openWorldlineGateway(session.sessionPayload, {
          hashAlgo: session.hashAlgo,
        });
        const { response: mergedGatewayResponse, debug: sdkDebug } =
          buildWorldlineCompletePayload(sdkResponse);

        setPaymentUiState('verifying');
        await completeWorldlinePayment({
          orderId: existingOrderId,
          txnId: session.txnId,
          response: mergedGatewayResponse,
          ...(sdkDebug ? { debug: sdkDebug } : {}),
        });

        const finalStatus = await pollWorldlineStatus(
          existingOrderId,
          (s) => setPaymentStatus(s),
          8
        );
        handleVerificationResult(finalStatus);
        return;
      }

      setPaymentUiState('creating_order');

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

      const orderPaymentType = toOrderPaymentMethodType(selectedKind);
      const paymentMethodId =
        orderPaymentType === 'digital'
          ? 'worldline_digital'
          : orderPaymentType === 'wallet'
            ? 'selorg_wallet'
            : '';

      const response = await createOrder({
        items: orderItems,
        addressId: resolvedAddressId,
        paymentMethodId,
        paymentMethodType: orderPaymentType,
        couponCode: appliedCoupon?.code,
        deliveryTip,
        customerName: routeCustomerName,
        customerEmail: routeCustomerEmail,
        customerPhone: routeCustomerPhone,
      });

      if (!response.success || !response.data) {
        throw new Error('Failed to create order');
      }

      const order = response.data;
      const orderId = order.id;
      setActiveOrderId(orderId);
      await saveInFlightPayment(orderId, selectedKind);

      const payStatus = String(order.paymentStatus || '').toLowerCase();
      const fullyPaidWithWallet =
        selectedKind === 'wallet' &&
        (payStatus === 'paid' || !order.requiresOnlinePayment);

      // 1. Cash on delivery — no Worldline gateway
      if (selectedKind === 'cash') {
        await clearCart();
        await finalizeOrder(orderId);
        return;
      }

      // 2. Full Selorg Wallet — paid server-side during createOrder
      if (fullyPaidWithWallet) {
        await clearCart();
        await finalizeOrder(orderId);
        return;
      }

      // Keep cart until online payment succeeds (digital or partial wallet).
      // 3. Digital / partial wallet — Worldline for remaining amount
      setPaymentUiState('opening_gateway');
      logger.info('Creating Worldline session', {
        orderId,
        paymentMode: 'all',
        walletDeduction: order.walletDeduction,
        onlineAmountDue: order.onlineAmountDue,
      });

      const session = await createWorldlineSession({
        orderId,
        consumerEmailId: routeCustomerEmail || user?.email,
        consumerMobileNo: routeCustomerPhone || user?.phoneNumber,
        paymentMode: 'all',
      });
      lastTxnIdRef.current = session.txnId;

      logger.info('Opening Worldline gateway', {
        txnId: session.txnId,
        paymentMode: selectedKind,
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

      logger.info('Starting payment status polling', { orderId });
      const finalStatus = await pollWorldlineStatus(orderId, (s) => setPaymentStatus(s), 8);
      handleVerificationResult(finalStatus);

    } catch (error: any) {
      logger.error('Payment flow failed', {
        error: error?.message,
        code: error?.code,
        orderId: activeOrderId || resumeOrderId,
      });
      setPaymentUiState('error');
      await refreshCart().catch(() => undefined);

      const errorMessage = error?.message || 'Something went wrong. Please check your connection and try again.';
      const isUserCancellation = errorMessage.toLowerCase().includes('cancel') || errorMessage.toLowerCase().includes('user');
      const failOrderId = activeOrderId || resumeOrderId;
      if (failOrderId && !isUserCancellation) {
        void recordPaymentFailure(failOrderId, errorMessage);
      }

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

  handlePlaceOrderRef.current = handlePlaceOrder;

  useEffect(() => {
    if (resumeOrderId) {
      setActiveOrderId(resumeOrderId);
    }
  }, [resumeOrderId]);

  useEffect(() => {
    if (!autoStartGateway) return;
    if (autoStartGatewayRef.current) return;
    if (selectedKind !== 'digital' && selectedKind !== 'wallet') return;
    // Fresh checkout needs an address; resume/retry only needs orderId.
    if (!resumeOrderId && !addressId && !routeAddressId) return;
    if (paymentUiState !== 'idle') return;

    autoStartGatewayRef.current = true;
    const timer = setTimeout(() => {
      void handlePlaceOrderRef.current?.();
    }, 400);
    return () => clearTimeout(timer);
  }, [autoStartGateway, selectedKind, addressId, routeAddressId, paymentUiState, resumeOrderId]);

  const finalizeOrder = async (orderId: string) => {
    try {
      // Coupon redemption for digital payment runs on backend after payment (releaseOrderFulfillment)
      if (appliedCoupon && selectedKind !== 'digital' && selectedKind !== 'wallet') {
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
          payment_method: selectedKind.toUpperCase(),
          zone: contextLocation?.area || '',
          delivery_fee: 0
        }).catch(err => logger.warn('Coupon redemption failed (non-blocking)', err));
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
      releaseEmptyCartLock();
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
                  const txnId =
                    lastTxnIdRef.current ||
                    paymentStatus?.latestPayment?.txnId ||
                    '';
                  if (txnId) {
                    await abortWorldlinePayment(
                      orderId,
                      txnId,
                      'user_cancelled'
                    ).catch((err) =>
                      logger.warn('Worldline abort failed; falling back to cancelOrder', err)
                    );
                  }
                  await cancelOrder(orderId);
                  releaseEmptyCartLock();
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
    return <StandalonePaymentFlow standalone={standaloneSession} navigation={navigation as any} />;
  }

  if (gatewayProcessing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.processingContainer}>
          <View style={styles.processingIconCircle}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
          <Text style={styles.processingTitle}>Processing Payment</Text>
          <Text style={styles.processingSubtitle}>
            Please wait while we open the secure Worldline payment gateway...
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

          {checkoutMethods.map((method) => {
            const isSelected = selectedMethodKey === method.key;
            return (
              <View
                key={method.key}
                style={[
                  styles.methodWrapper,
                  isSelected && styles.methodWrapperSelected,
                  method.disabled && { opacity: 0.55 },
                ]}
              >
                <TouchableOpacity
                  style={styles.methodCard}
                  onPress={() => {
                    if (method.disabled) {
                      Alert.alert(
                        'Wallet Unavailable',
                        method.disabledReason || 'Add money to your Selorg Wallet to use this option.',
                      );
                      return;
                    }
                    setSelectedMethodKey(method.key);
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
                      {method.kind === 'wallet' && !method.disabled ? (
                        <Text style={[styles.methodDescription, { color: '#034703', marginTop: 4 }]}>
                          Balance {formatInr(walletBalance)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Info note */}
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>🔒</Text>
            <Text style={styles.infoText}>
              {selectedKind === 'cash'
                ? 'You will pay the delivery partner in cash when your order arrives.'
                : selectedKind === 'wallet'
                  ? walletBalance >= totalBill && totalBill > 0
                    ? 'Your Selorg Wallet balance will be used to pay for this order in full.'
                    : 'Available wallet balance will be applied first; you will complete the remaining amount securely online.'
                  : 'You will be redirected to the Worldline payment gateway to complete payment.'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Place Order Button */}
      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Animated.View style={{ transform: [{ scale: placeOrderScale }], width: '100%' }}>
          {(() => {
            const isDisabled =
              (paymentUiState !== 'idle' && paymentUiState !== 'failed' && paymentUiState !== 'error') ||
              !!selectedMethod?.disabled;
            const buttonDisabled = isDisabled;

            let buttonLabel = `Place Order  •  ₹${totalBill.toFixed(0)}`;
            if (selectedKind === 'digital') {
              buttonLabel = `Pay via Worldline  •  ₹${totalBill.toFixed(0)}`;
            } else if (selectedKind === 'wallet') {
              buttonLabel =
                walletBalance >= totalBill && totalBill > 0
                  ? `Pay with Wallet  •  ₹${totalBill.toFixed(0)}`
                  : `Pay with Wallet + Online  •  ₹${totalBill.toFixed(0)}`;
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

});

export default Payment;
