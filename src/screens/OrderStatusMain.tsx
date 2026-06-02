/**
 * Order Status Main Screen
 *
 * Displays the user's active order with map view, delivery status,
 * and dynamic data fetched from the backend.
 *
 * @format
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { OrdersStackNavigationProp, RootStackNavigationProp } from '../types/navigation';
import Header from '../components/layout/Header';
import RouteMap, { type RouteInfo } from '../components/features/location/RouteMap';
import ErrorBoundary from '../components/common/ErrorBoundary';
import ChevronRightIcon from '../assets/images/chevron-right.svg';
import ChatIconOrder from '../assets/images/chat-icon-order.svg';
import OrderStatusIcon from '../assets/images/order-status-icon.svg';
import { useLocation } from '../contexts/LocationContext';
import { getActiveOrder, type ActiveOrder } from '../services/orders/orderService';
import { logger } from '@/utils/logger';
import { getProductImageUrl } from '../utils/productImage';
import { pollWorldlineStatus, getWorldlineStatus } from '../services/payments/worldlineCheckout';

const STATUS_MESSAGES: Record<string, string> = {
  pending: 'Your order has been placed',
  confirmed: 'Your order is confirmed',
  'getting-packed': 'Your order is getting packed',
  'on-the-way': 'Your order is on the way',
  arrived: 'Your delivery partner has arrived',
  delivered: 'Your order has been delivered',
  cancelled: 'Your order has been cancelled',
};

const OrderStatusMain: React.FC = () => {
  const navigation = useNavigation<OrdersStackNavigationProp>();
  const rootNavigation = useNavigation<RootStackNavigationProp>();
  const { location: userLocation, getCurrentLocation } = useLocation();

  const [order, setOrder] = useState<ActiveOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshingPayment, setIsRefreshingPayment] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [riderLocation, setRiderLocation] = useState<{ latitude: number; longitude: number; heading?: number } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchOrder = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const response = await getActiveOrder();
      if (response.success && response.data) {
        const activeOrder = response.data;

        if (activeOrder.status === 'delivered') {
          navigation.navigate('OrderReceived', { orderId: activeOrder.id });
          setOrder(null);
          return;
        }

        if (activeOrder.status === 'cancelled') {
          navigation.navigate('OrderCanceledDetails', { orderId: activeOrder.id });
          setOrder(null);
          return;
        }

        setOrder(activeOrder);
      } else {
        setOrder(null);
      }
    } catch (err) {
      logger.error('Error fetching active order', err);
      setError('Failed to load order. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  const handlePaymentRetry = async () => {
    if (!order) return;
    setIsRefreshingPayment(true);
    try {
      if (order.paymentStatus === 'pending') {
        const status = await getWorldlineStatus(order.id);
        if (status.orderPaymentStatus === 'paid') {
          fetchOrder();
        } else {
          Alert.alert('Still Pending', 'Bank has not confirmed your payment yet. Please try again in a few minutes.');
        }
      } else {
        // Redirect back to payment screen for retry
        rootNavigation.navigate('Payment', {
          orderId: order.id,
          totalBill: order.totalBill,
          itemCount: order.items.length,
          addressId: order.deliveryAddress.id,
        });
      }
    } catch (err) {
      logger.warn('Failed to retry/refresh payment', err);
    } finally {
      setIsRefreshingPayment(false);
    }
  };

  const renderPaymentStatusBanner = () => {
    if (!order || order.paymentMethod.type === 'cash' || order.paymentStatus === 'paid') return null;

    const isFailed = order.paymentStatus === 'failed';
    const isPending = order.paymentStatus === 'pending';

    return (
      <View style={[styles.paymentBanner, isFailed ? styles.paymentBannerFailed : styles.paymentBannerPending]}>
        <View style={styles.paymentBannerContent}>
          <Text style={styles.paymentBannerTitle}>
            {isFailed ? 'Payment Failed' : 'Payment Verification Pending'}
          </Text>
          <Text style={styles.paymentBannerSubtext}>
            {isFailed 
              ? 'Your online payment was not successful.' 
              : 'We are waiting for bank confirmation. This usually takes a few minutes.'}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.paymentBannerAction} 
          onPress={handlePaymentRetry}
          disabled={isRefreshingPayment}
        >
          {isRefreshingPayment ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.paymentBannerActionText}>{isFailed ? 'Retry' : 'Refresh'}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // Fetch location once on mount
  useEffect(() => {
    if (!userLocation) {
      getCurrentLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isFirstOrderFocus = useRef(true);

  useRefreshOnFocus(() => {
    void fetchOrder(isFirstOrderFocus.current);
    if (isFirstOrderFocus.current) {
      isFirstOrderFocus.current = false;
    }
  }, [fetchOrder]);

  // Connect WebSocket when order exists; handle status_update and rider_location
  useEffect(() => {
    if (!order?.id) return;
    try {
      const { getEnvConfigSafe } = require('../config/env');
      const base = getEnvConfigSafe().apiBaseUrl.replace(/\/api\/v1\/customer\/?$/, '').replace(/^http/, 'ws');
      const custId = `cust-${order.id}`;
      const wsUrl = `${base}/ws?userId=${encodeURIComponent(custId)}&userType=customer`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        try {
          ws.send(JSON.stringify({ type: 'subscribe', orderId: order.id }));
        } catch (_) {}
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'rider:location:update' || msg.event === 'rider:location:update') {
            const loc = msg.payload || msg.data || msg;
            if (loc.latitude && loc.longitude) {
              setRiderLocation({ latitude: loc.latitude, longitude: loc.longitude, heading: loc.heading });
            }
          } else if (msg.type === 'status_update' && msg.payload) {
            const payload = msg.payload;
            if (payload.status === 'delivered') {
              navigation.navigate('OrderReceived', { orderId: order.id });
              setOrder(null);
            } else if (payload.status === 'cancelled') {
              navigation.navigate('OrderCanceledDetails', { orderId: order.id });
              setOrder(null);
            } else if (payload.order) {
              setOrder((prev) => {
                if (!prev || prev.id !== order.id) return prev;
                return { ...prev, ...payload.order, status: payload.status ?? prev.status };
              });
            } else {
              setOrder((prev) => {
                if (!prev || prev.id !== order.id) return prev;
                return { ...prev, status: payload.status };
              });
            }
          }
        } catch (_) {}
      };
      ws.onerror = () => {};
      ws.onclose = () => {};
      return () => {
        try {
          const w = wsRef.current;
          if (w && (w.readyState === WebSocket.OPEN || w.readyState === WebSocket.CONNECTING)) {
            w.send(JSON.stringify({ type: 'unsubscribe', orderId: order.id }));
            w.close();
          }
          wsRef.current = null;
        } catch (_) {}
      };
    } catch (_) {
      return undefined;
    }
  }, [order?.id, navigation]);

  const handleOrderPress = useCallback(
    (activeOrder: ActiveOrder) => {
      const orderItems = (activeOrder.items || []).map((item) => ({
        id: item.id,
        name: item.productName,
        weight: item.variantSize || '',
        quantity: item.quantity,
        discountedPrice: item.price,
        originalPrice: item.originalPrice ?? item.price,
        image: getProductImageUrl({
          id: String(item.productId ?? item.id ?? ''),
          name: item.productName,
          imageUrl:
            (typeof (item as any).imageUrl === 'string' ? (item as any).imageUrl : undefined) ??
            (typeof (item as any).image?.uri === 'string' ? (item as any).image.uri : undefined) ??
            (typeof (item as any).image?.url === 'string' ? (item as any).image.url : undefined) ??
            (typeof (item as any).image?.imageUrl === 'string' ? (item as any).image.imageUrl : undefined) ??
            (typeof (item as any).image === 'string' ? (item as any).image : undefined),
          image: (item as any).image,
        }),
        itemStatus: item.itemStatus,
      }));

      navigation.navigate('OrderItemsDetails', {
        orderId: activeOrder.id,
        orderNumber: activeOrder.orderNumber,
        status: activeOrder.status as 'getting-packed' | 'on-the-way' | 'arrived',
        deliveryAddress: activeOrder.deliveryAddress?.address || '',
        items: orderItems,
        totalSavings:
          orderItems.reduce((s, i) => s + (i.originalPrice - i.discountedPrice) * i.quantity, 0),
        itemTotal: activeOrder.itemTotal,
        handlingCharge: activeOrder.handlingCharge,
        deliveryFee: activeOrder.deliveryFee,
        totalBill: activeOrder.totalBill,
        createdAt: activeOrder.createdAt,
      });
    },
    [navigation],
  );

  /** ETA from map route data (duration in mins), fallback to order if map not ready */
  const formatEtaMins = (): string => {
    const mins = routeInfo?.durationMinutes ?? order?.deliveryTimeMinutes ?? null;
    if (mins == null || mins <= 0) return 'Soon';
    if (mins > 120) return 'Soon';
    return `${mins} mins`;
  };

  const storeCoords = order?.storeCoordinates ?? undefined;
  const addressCoords = order?.addressCoordinates ?? undefined;

  const gpsLocation =
    userLocation && userLocation.latitude && userLocation.longitude
      ? { latitude: userLocation.latitude, longitude: userLocation.longitude }
      : undefined;

  // Delivery route: Store (origin) → Your address (destination)
  const mapOrigin = storeCoords;
  const mapDestination = addressCoords ?? gpsLocation;

  const renderMapView = () => {
    if (!order) return null;

    if (!mapOrigin && !mapDestination) {
      return (
        <View style={styles.mapContainer}>
          <View style={styles.mapLoadingContainer}>
            <ActivityIndicator size="small" color="#034703" />
            <Text style={styles.mapLoadingText}>Loading map...</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.mapContainer}>
        <ErrorBoundary
          fallback={
            <View style={styles.mapErrorContainer}>
              <Text style={styles.mapErrorText}>Unable to load map</Text>
              <Text style={styles.mapErrorSubtext}>Please check your location permissions</Text>
            </View>
          }
        >
          <RouteMap
            deliveryAddress={order.deliveryAddress?.address || ''}
            deliveryCoordinates={mapDestination}
            currentLocation={mapOrigin}
            driverCoordinates={riderLocation || undefined}
            height={240}
            showRouteInfo
            routeInfoDisplay="distanceOnly"
            onRouteInfo={setRouteInfo}
            originLabel={(() => {
              const name = order.storeName || 'Darkstore';
              return name.replace(/\s*Darkstore\s*/i, '').trim() || 'Store';
            })()}
            destinationLabel="You"
          />
        </ErrorBoundary>
      </View>
    );
  };

  const renderOrderCard = () => {
    if (!order) return null;

    const itemCount = (order.items || []).reduce((sum, i) => sum + i.quantity, 0);
    const savings =
      (order.items || []).reduce(
        (sum, i) => sum + ((i.originalPrice ?? i.price) - i.price) * i.quantity,
        0,
      );
    const deliveryPartnerName = order.deliveryPartner?.name || null;
    const addressDisplay =
      order.deliveryAddress?.address ||
      [order.deliveryAddress?.line1, order.deliveryAddress?.line2, order.deliveryAddress?.city]
        .filter(Boolean)
        .join(', ') ||
      '';

    const awaitingOnlinePayment =
      order.paymentMethod?.type !== 'cash' &&
      order.paymentStatus === 'pending' &&
      order.status === 'pending';

    const statusMessage = awaitingOnlinePayment
      ? 'Waiting for payment confirmation'
      : STATUS_MESSAGES[order.status] || 'Processing your order';

    return (
      <View style={styles.orderCardContainer}>
        {/* Main Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusImageContainer}>
            <OrderStatusIcon width={137.32} height={119.27} />
          </View>

          <View style={styles.statusInfoContainer}>
            <View style={styles.statusInfo}>
              <View style={styles.statusLabelContainer}>
                <Text style={styles.arrivingLabel}>{awaitingOnlinePayment ? 'Payment' : 'Arriving in'}</Text>
              </View>
              <Text style={styles.deliveryTime}>
                {awaitingOnlinePayment ? 'Pending' : formatEtaMins()}
              </Text>
            </View>
            <Text style={styles.statusMessage}>{statusMessage}</Text>
          </View>
        </View>

        {/* Order Info Cards */}
        <View style={styles.infoCardsContainer}>
          {deliveryPartnerName && (
            <View style={styles.infoCard}>
              <View style={styles.infoCardContent}>
                <View style={styles.avatarContainer}>
                  <Image
                    source={require('../assets/images/delivery-partner-avatar-main.png')}
                    style={styles.avatar}
                  />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>{deliveryPartnerName}</Text>
                  <Text style={styles.infoSubtitle}>Delivery partner</Text>
                </View>
              </View>
            </View>
          )}

          {order.storeName ? (
            <View style={styles.infoCard}>
              <View style={styles.infoCardContent}>
                <View style={styles.storeIconContainer}>
                  <Text style={styles.storeIconText}>DS</Text>
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>{order.storeName}</Text>
                  <Text style={styles.infoSubtitle}>{order.storeAddress || 'Fulfillment center'}</Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* Order Summary Card */}
          <TouchableOpacity
            style={styles.infoCard}
            onPress={() => handleOrderPress(order)}
            activeOpacity={0.7}
          >
            <View style={styles.orderSummaryCardContent}>
              <View style={styles.productImageContainer}>
                <Image
                  source={require('../assets/images/product-image-main.png')}
                  style={styles.productImage}
                />
              </View>
              <View style={styles.orderInfoContainer}>
                <View style={styles.orderSummaryRow}>
                  <View style={styles.itemsAndSavingsContainer}>
                    <Text style={styles.itemCount}>{itemCount} items</Text>
                    {savings > 0 && (
                      <View style={styles.savingsContainer}>
                        <Text style={styles.savingsText}>₹{savings.toFixed(1)} saved</Text>
                      </View>
                    )}
                    <View style={styles.chevronContainer}>
                      <ChevronRightIcon width={14} height={14} />
                    </View>
                  </View>
                </View>
                {addressDisplay ? (
                  <View style={styles.deliveryAddressContainer}>
                    <Text style={styles.deliveryAddress}>
                      Delivering to {order.addressLabel || 'home'}: {addressDisplay}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>

          {/* Help Card */}
          <TouchableOpacity
            style={styles.infoCard}
            onPress={() => rootNavigation.navigate('CustomerSupport', { orderId: order.id })}
            activeOpacity={0.7}
          >
            <View style={styles.infoCardContent}>
              <View style={styles.helpIconContainer}>
                <ChatIconOrder width={28} height={28} />
              </View>
              <View style={styles.helpTextContainer}>
                <Text style={styles.helpTitle}>Need help with this order?</Text>
                <Text style={styles.helpSubtitle}>
                  Chat with us now — we're just a tap away
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Order status" showBackButton onBackPress={() => rootNavigation.goBack()} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderPaymentStatusBanner()}
        {renderMapView()}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#034703" />
            <Text style={styles.loadingText}>Loading order...</Text>
          </View>
        ) : error ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => fetchOrder(true)} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : !order ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No active order</Text>
            <TouchableOpacity
              onPress={() => rootNavigation.navigate('MainTabs')}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        ) : (
          renderOrderCard()
        )}
      </ScrollView>
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
    paddingBottom: 20,
  },
  mapContainer: {
    width: '100%',
    height: 240,
    marginBottom: 16,
    borderRadius: 0,
    overflow: 'hidden',
  },
  mapLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
  },
  mapLoadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#828282',
  },
  loadingContainer: {
    paddingHorizontal: 16,
    paddingTop: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyContainer: {
    paddingHorizontal: 16,
    paddingTop: 40,
    alignItems: 'center',
    gap: 16,
  },
  orderCardContainer: {
    backgroundColor: '#F5F5F5',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 22,
    paddingHorizontal: 16,
    paddingBottom: 0,
    gap: 10,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F4F4F4',
    padding: 20,
    paddingHorizontal: 16,
    gap: 67,
  },
  statusImageContainer: {
    width: 137.32,
    height: 119.27,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusInfoContainer: {
    flex: 1,
    gap: 12,
  },
  statusInfo: {
    gap: 8,
    alignItems: 'flex-start',
  },
  statusLabelContainer: {
    width: 72,
    alignItems: 'center',
  },
  arrivingLabel: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    color: '#828282',
    textAlign: 'center',
  },
  deliveryTime: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    color: '#175FBE',
    textAlign: 'center',
  },
  statusMessage: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
    color: '#4C4C4C',
  },
  infoCardsContainer: {
    gap: 8,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 0.6,
    borderColor: '#F4F4F4',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  infoCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#DDDDDD',
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  infoContent: {
    flex: 1,
    gap: 4,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: '#1A1A1A',
  },
  infoSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: '#828282',
  },
  orderSummaryCardContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    gap: 12,
  },
  productImageContainer: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#DDDDDD',
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  orderInfoContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  orderSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  itemsAndSavingsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  itemCount: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    color: '#4C4C4C',
  },
  savingsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevronContainer: {
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  savingsText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    color: '#034703',
  },
  deliveryAddressContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'stretch',
  },
  deliveryAddress: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: '#828282',
    flex: 1,
  },
  storeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeIconText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#034703',
  },
  helpIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#DDDDDD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpTextContainer: {
    flex: 1,
    gap: 4,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: '#1A1A1A',
  },
  helpSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: '#828282',
  },
  loadingText: {
    textAlign: 'center',
    color: '#828282',
    fontSize: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#828282',
    fontSize: 16,
  },
  errorText: {
    textAlign: 'center',
    color: '#FF3B30',
    fontSize: 15,
  },
  retryButton: {
    backgroundColor: '#034703',
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  mapErrorContainer: {
    width: '100%',
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  mapErrorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  mapErrorSubtext: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
  },
  paymentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  paymentBannerPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FEF3C7',
  },
  paymentBannerFailed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },
  paymentBannerContent: {
    flex: 1,
  },
  paymentBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  paymentBannerSubtext: {
    fontSize: 12,
    color: '#4C4C4C',
    marginTop: 2,
  },
  paymentBannerAction: {
    backgroundColor: '#034703',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  paymentBannerActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default OrderStatusMain;
