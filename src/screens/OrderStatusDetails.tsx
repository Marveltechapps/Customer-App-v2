/**
 * Order Status Details Screen
 * 
 * This screen shows detailed information about an order's status.
 * Displays different views based on order status:
 * - Getting Packed
 * - On the Way
 * - Arrived
 * 
 * Features:
 * - Status-specific UI based on order state
 * - Delivery partner information
 * - Order summary
 * - Help and support options
 * - Ready for API integration
 * 
 * @format
 */

import React, { useState, useEffect, Component, type ReactNode, type ErrorInfo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, CommonActions } from '@react-navigation/native';
import { logger } from '@/utils/logger';
import type {
  OrdersStackNavigationProp,
  OrdersStackRouteProp,
  RootStackNavigationProp,
} from '../types/navigation';
import Header from '../components/layout/Header';
import DeliveryTimeline from '../components/order/DeliveryTimeline';
import RouteMap from '../components/features/location/RouteMap';
import { useLocation } from '../contexts/LocationContext';
import { useAppConfig } from '../contexts/AppConfigContext';
import { getOrderById } from '../services/orders/orderService';
import { getProductImageUrl } from '../utils/productImage';
import PhoneIcon from '../assets/images/phone-icon.svg';
import RupeeIcon from '../assets/images/rupee-icon.svg';
import ChevronRightIcon from '../assets/images/chevron-right.svg';
import ChatIconOrder from '../assets/images/chat-icon-order.svg';

type OrderStatusType = 'getting-packed' | 'on-the-way' | 'arrived';

interface OrderDetails {
  id: string;
  orderNumber?: string;
  status: OrderStatusType;
  deliveryTimeMinutes: number;
  statusMessage: string;
  itemCount: number;
  savings: number;
  deliveryAddress: string;
  deliveryPartnerName?: string;
  productImage?: string;
  orderItems?: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    originalPrice: number;
    image?: string;
  }>;
  timeline?: Array<{ status: string; timestamp: string; note?: string }>;
  currentStatus?: string;
  createdAt?: string;
}

class ErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('ErrorBoundary caught', error, info as any);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

const mapApiStatusToUi = (apiStatus: string): OrderStatusType => {
  if (['delivered', 'arrived'].includes(apiStatus)) return 'arrived';
  if (['out_for_delivery', 'on_the_way', 'on-the-way'].includes(apiStatus)) return 'on-the-way';
  return 'getting-packed';
};

const getStatusMessage = (apiStatus: string): string => {
  if (['delivered', 'arrived'].includes(apiStatus)) return 'Your order has arrived';
  if (['out_for_delivery', 'on_the_way', 'on-the-way'].includes(apiStatus)) return 'Your order is on the way';
  if (apiStatus === 'pending') return 'Your order has been placed';
  if (apiStatus === 'confirmed') return 'Your order is confirmed';
  return 'Your order is getting packed';
};

const OrderStatusDetails: React.FC = () => {
  const route = useRoute<OrdersStackRouteProp<'OrderStatusDetails'>>();
  const navigation = useNavigation<OrdersStackNavigationProp>();
  const rootNavigation = useNavigation<RootStackNavigationProp>();
  const { location: userLocation, getCurrentLocation } = useLocation();
  const { appConfig } = useAppConfig();
  const { orderId, status } = route.params;

  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [addressCoordinates, setAddressCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const [driverCoordinates, setDriverCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [wsRef, setWsRef] = useState<WebSocket | null>(null);

  // Fetch order from API
  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!orderId) return;
      setLoading(true);
      try {
        const orderData = await getOrderById(orderId);
        const o = (orderData as any)?.data ?? orderData;
        if (o) {
          const uiStatus = mapApiStatusToUi(o.status);
          const addr = o.deliveryAddress;
          const addrStr = typeof addr === 'string' ? addr : (addr?.address ?? [addr?.line1, addr?.line2].filter(Boolean).join(', ') ?? '');
          const items = (o.items ?? []) as any[];
          const totalQty = items.reduce((sum: number, it: any) => sum + (it.quantity ?? 1), 0);
          const totalSavings = items.reduce((sum: number, it: any) => {
            const orig = it.originalPrice ?? it.price ?? 0;
            const disc = it.price ?? 0;
            return sum + (orig - disc) * (it.quantity ?? 1);
          }, 0);

          let etaMinutes: number;
          if (uiStatus === 'arrived') {
            etaMinutes = 0;
          } else if (o.estimatedDelivery) {
            etaMinutes = Math.max(0, Math.round((new Date(o.estimatedDelivery).getTime() - Date.now()) / 60000));
          } else if (o.deliveryTimeMinutes != null) {
            etaMinutes = o.deliveryTimeMinutes;
          } else {
            etaMinutes = uiStatus === 'on-the-way' ? 8 : 15;
          }

          const mapped: OrderDetails = {
            id: o.id ?? orderId,
            orderNumber: o.orderNumber,
            status: uiStatus,
            deliveryTimeMinutes: etaMinutes,
            statusMessage: getStatusMessage(o.status),
            itemCount: totalQty,
            savings: totalSavings,
            deliveryAddress: addrStr || 'Delivery address',
            deliveryPartnerName: o.deliveryPartner?.name ?? o.riderName ?? o.deliveryPartnerName ?? undefined,
            orderItems: items.map((it: any) => ({
              id: it.id ?? String(it.productId),
              name: it.productName ?? 'Item',
              quantity: it.quantity ?? 1,
              price: it.price ?? 0,
              originalPrice: it.originalPrice ?? it.price ?? 0,
              image: it.image,
            })),
            timeline: o.timeline ?? [],
            currentStatus: o.status,
            createdAt: o.createdAt,
          };
          setOrderDetails(mapped);
          const addrCoords = o.addressCoordinates;
          if (addrCoords && typeof addrCoords.latitude === 'number' && typeof addrCoords.longitude === 'number') {
            setAddressCoordinates({ latitude: addrCoords.latitude, longitude: addrCoords.longitude });
          } else {
            setAddressCoordinates(null);
          }
        } else {
          setOrderDetails(null);
          setAddressCoordinates(null);
        }
      } catch (error) {
        logger.error('Error fetching order details', error);
        setOrderDetails(null);
        setAddressCoordinates(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [orderId, status]);

  useEffect(() => {
    if (!userLocation) {
      getCurrentLocation();
    }
  }, [userLocation, getCurrentLocation]);

  // WebSocket for real-time order status and rider location - connect when orderId exists (any status)
  useEffect(() => {
    if (!orderId) return;
    try {
      const { getEnvConfigSafe } = require('../config/env');
      const base = getEnvConfigSafe().apiBaseUrl.replace(/\/api\/v1\/customer\/?$/, '').replace(/^http/, 'ws');
      const custId = `cust-${orderId}`;
      const wsUrl = `${base}/ws?userId=${encodeURIComponent(custId)}&userType=customer`;
      const ws = new WebSocket(wsUrl);
      setWsRef(ws);
      ws.onopen = () => {
        try {
          ws.send(JSON.stringify({ type: 'subscribe', orderId }));
        } catch (_) {}
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'rider_location' && msg.payload?.currentLocation) {
            const loc = msg.payload.currentLocation;
            setDriverCoordinates({ latitude: loc.lat, longitude: loc.lng });
          }
          if (msg.type === 'status_update' && msg.payload) {
            const payload = msg.payload;
            setOrderDetails((prev) => {
              if (!prev) return prev;
              const newStatus = mapApiStatusToUi(payload.status);
              const timelineEntry = payload.status
                ? { status: payload.status, timestamp: new Date().toISOString() }
                : null;
              return {
                ...prev,
                status: newStatus,
                currentStatus: payload.status ?? prev.currentStatus,
                timeline: timelineEntry
                  ? [...(prev.timeline || []), timelineEntry]
                  : prev.timeline,
              };
            });
            if (['delivered', 'arrived'].includes(payload.status)) {
              navigation.navigate('OrderReceived', { orderId });
            } else if (payload.status === 'cancelled') {
              navigation.navigate('OrderCanceledDetails', { orderId });
            }
          }
        } catch (_) {}
      };
      ws.onerror = () => {};
      ws.onclose = () => {};
      return () => {
        try {
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.send(JSON.stringify({ type: 'unsubscribe', orderId }));
            ws.close();
          }
        } catch (_) {}
        setWsRef(null);
      };
    } catch (_) {}
  }, [orderId, navigation]);

  const formatDeliveryTime = (minutes: number): string => {
    if (minutes <= 0) return 'Arrived';
    if (minutes > 120) return 'Arriving soon';
    return `${minutes} mins`;
  };

  const handleSavingsPress = () => {
    logger.info('handleSavingsPress called');
    
    if (!orderDetails) {
      logger.info('orderDetails is null');
      return;
    }
    
    if (!navigation) {
      logger.info('navigation is null');
      Alert.alert('Error', 'Navigation not available');
      return;
    }
    
    const itemTotal = orderDetails.orderItems?.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    ) || 0;
    const totalSavings = orderDetails.savings;
    const handlingCharge = appConfig.checkout?.handlingCharge ?? 5;
    const deliveryFee = appConfig.checkout?.deliveryFee ?? 0;
    const totalBill = itemTotal + handlingCharge + deliveryFee;
    
    const navigationParams = {
      orderId: orderDetails.id,
      orderNumber: orderDetails.orderNumber,
      status: orderDetails.status,
      deliveryAddress: orderDetails.deliveryAddress,
      items: orderDetails.orderItems?.map((item) => ({
        id: item.id,
        name: item.name,
        weight: '',
        quantity: item.quantity,
        discountedPrice: item.price,
        originalPrice: item.originalPrice,
        image: getProductImageUrl({
          id: String((item as any).productId ?? item.id ?? ''),
          name: item.name,
          imageUrl:
            (typeof (item as any).imageUrl === 'string' ? (item as any).imageUrl : undefined) ??
            (typeof (item as any).image?.uri === 'string' ? (item as any).image.uri : undefined) ??
            (typeof (item as any).image?.url === 'string' ? (item as any).image.url : undefined) ??
            (typeof (item as any).image?.imageUrl === 'string' ? (item as any).image.imageUrl : undefined) ??
            (typeof (item as any).image === 'string' ? (item as any).image : undefined),
          image: (item as any).image,
        }),
      })) || [],
      totalSavings,
      itemTotal,
      handlingCharge,
      deliveryFee,
      totalBill,
      createdAt: orderDetails.createdAt,
    };
    
    // Navigate directly to OrderItemsDetails screen, skipping any intermediate screens
    try {
      // Try push first - this will add OrderItemsDetails to the stack
      if ('push' in navigation && typeof (navigation as any).push === 'function') {
        (navigation as any).push('OrderItemsDetails', navigationParams);
      } else {
        // Fallback to navigate
        navigation.navigate('OrderItemsDetails', navigationParams);
      }
    } catch (error) {
      logger.error('Navigation error', error);
      // If navigation fails, try using dispatch
      try {
        navigation.dispatch(
          CommonActions.navigate({
            name: 'OrderItemsDetails',
            params: navigationParams,
          })
        );
      } catch (dispatchError) {
        logger.error('Navigation dispatch error', dispatchError);
        Alert.alert('Error', 'Failed to navigate to order items details');
      }
    }
  };

  const renderStatusCard = () => {
    if (!orderDetails) return null;

    return (
      <View style={styles.statusCard}>
        <View style={styles.statusImageContainer}>
          <Image
            source={require('../assets/images/product-image-order-35125f.png')}
            style={styles.statusImage}
            resizeMode="contain"
          />
        </View>
        <View style={styles.statusInfoContainer}>
          <View style={styles.statusTimeContainer}>
            <View style={styles.statusLabelContainer}>
              <Text style={styles.arrivingLabel}>Arriving in</Text>
            </View>
            <Text style={styles.deliveryTime}>
              {formatDeliveryTime(orderDetails.deliveryTimeMinutes)}
            </Text>
          </View>
          <View style={styles.statusMessageContainer}>
            <Text style={styles.statusMessage}>{orderDetails.statusMessage}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderDeliveryPartner = () => {
    if (!orderDetails?.deliveryPartnerName) return null;

    return (
      <View style={styles.infoCard}>
        <View style={styles.deliveryPartnerContent}>
          <View style={styles.avatarContainer}>
            <Image
              source={require('../assets/images/delivery-partner-avatar-35125f.png')}
              style={styles.avatar}
            />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>
              {orderDetails.deliveryPartnerName}
            </Text>
            <Text style={styles.infoSubtitle}>Delivery partner</Text>
          </View>
        </View>
      </View>
    );
  };

  const handleOrderSummaryPress = () => {
    if (!orderDetails) {
      return;
    }
    handleSavingsPress();
  };

  const renderOrderSummary = () => {
    if (!orderDetails) return null;

    return (
      <TouchableOpacity
        style={styles.infoCard}
        onPress={handleOrderSummaryPress}
        activeOpacity={0.7}
        delayPressIn={0}
        delayPressOut={0}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View style={styles.orderSummaryCardContent}>
          <View style={styles.orderSummaryImageContainer}>
            <Image
              source={require('../assets/images/product-image-order-35125f.png')}
              style={styles.orderSummaryImage}
            />
          </View>
          <View style={styles.orderSummaryInfoContainer}>
            <View style={styles.orderSummaryRow}>
              <Text style={styles.itemCount}>{orderDetails.itemCount} items</Text>
              <View style={styles.savingsContainer}>
                <RupeeIcon width={9} height={12} />
                <Text style={styles.savingsText}>
                  {orderDetails.savings.toFixed(1)} saved
                </Text>
              </View>
              <View style={styles.chevronContainer}>
                <ChevronRightIcon width={14} height={14} />
              </View>
            </View>
            <Text style={styles.deliveryAddress}>
              {orderDetails.deliveryAddress}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderOrderItems = () => {
    if (!orderDetails?.orderItems) return null;

    return (
      <View style={styles.orderItemsContainer}>
        <Text style={styles.sectionTitle}>Order Items</Text>
        {orderDetails.orderItems.map((item) => (
          <View key={item.id} style={styles.orderItem}>
            <View style={styles.orderItemImageContainer}>
              <Image
                source={require('../assets/images/product-image-order-35125f.png')}
                style={styles.orderItemImage}
              />
            </View>
            <View style={styles.orderItemInfo}>
              <Text style={styles.orderItemName}>{item.name}</Text>
              <Text style={styles.orderItemQuantity}>
                Quantity: {item.quantity}
              </Text>
            </View>
            <Text style={styles.orderItemPrice}>₹{item.price}</Text>
          </View>
        ))}
      </View>
    );
  };

  const handleNeedHelp = () => {
    rootNavigation.navigate('CustomerSupport', { orderId });
  };

  const renderHelpCard = () => {
    return (
      <TouchableOpacity style={styles.infoCard} onPress={handleNeedHelp} activeOpacity={0.7}>
        <View style={styles.helpContent}>
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
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Order Details" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading order details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!orderDetails) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Order Details" />
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>Order not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Order Details" />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={true}
      >
        {/* Delivery Timeline */}
        {orderDetails?.timeline && orderDetails.timeline.length > 0 && (
          <View style={styles.timelineSection}>
            <DeliveryTimeline
              timeline={orderDetails.timeline}
              currentStatus={orderDetails.currentStatus ?? orderDetails.status}
            />
          </View>
        )}

        {/* Route Map - Full width on top */}
        {orderDetails && (
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
                deliveryAddress={orderDetails.deliveryAddress}
                deliveryCoordinates={addressCoordinates ?? undefined}
                currentLocation={
                  userLocation && userLocation.latitude != null && userLocation.longitude != null
                    ? { latitude: userLocation.latitude, longitude: userLocation.longitude }
                    : undefined
                }
                driverCoordinates={driverCoordinates ?? undefined}
                height={200}
                showRouteInfo
                originLabel="You"
                destinationLabel="Store"
              />
            </ErrorBoundary>
          </View>
        )}

        {/* Cards Container with proper padding */}
        <View style={styles.cardsContainer}>
          {/* Inner Container with 12px gap */}
          <View style={styles.innerContainer}>
            {/* Status Card */}
            {renderStatusCard()}

            {/* Info Cards Container with 8px gap */}
            <View style={styles.infoCardsContainer}>
              {/* Delivery Partner */}
              {renderDeliveryPartner()}

              {/* Order Summary */}
              {renderOrderSummary()}

              {/* Help Card */}
              {renderHelpCard()}

              {/* Modify Order Button - only for pending/confirmed orders */}
              {orderDetails.currentStatus &&
                ['pending', 'confirmed'].includes(orderDetails.currentStatus) && (
                <TouchableOpacity
                  style={styles.modifyOrderButton}
                  onPress={() => Alert.alert('Coming Soon', 'Order modification will be available in a future update.')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modifyOrderButtonText}>Modify Order</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
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
  timelineSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  mapContainer: {
    width: '100%',
    borderRadius: 0,
    overflow: 'hidden',
  },
  cardsContainer: {
    paddingTop: 22,
    paddingHorizontal: 16,
    paddingBottom: 22,
    backgroundColor: '#F5F5F5',
  },
  innerContainer: {
    gap: 12, // Exact gap from Figma layout_VC7GFE
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#828282',
  },
  emptyText: {
    fontSize: 16,
    color: '#828282',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F4F4F4',
    padding: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 67, // Exact gap from Figma
  },
  statusImageContainer: {
    width: 137.32,
    height: 119.27,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusImage: {
    width: '100%',
    height: '100%',
  },
  statusInfoContainer: {
    flex: 1,
    gap: 12,
  },
  statusTimeContainer: {
    gap: 8,
    alignItems: 'flex-start',
  },
  statusLabelContainer: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrivingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#828282',
    textAlign: 'center',
    lineHeight: 20,
  },
  deliveryTime: {
    fontSize: 24,
    fontWeight: '700',
    color: '#175FBE',
    textAlign: 'center',
    lineHeight: 32,
  },
  statusMessageContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  statusMessage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4C4C4C',
    lineHeight: 20,
  },
  infoCardsContainer: {
    gap: 8,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 16,
    borderWidth: 0.6,
    borderColor: '#F4F4F4',
  },
  deliveryPartnerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12, // Exact gap from Figma layout_003BQA
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
    color: '#1A1A1A',
  },
  infoSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#828282',
  },
  orderSummaryCardContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12, // Exact gap from Figma layout_BIRHPZ
  },
  orderSummaryImageContainer: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#DDDDDD',
    overflow: 'hidden',
  },
  orderSummaryImage: {
    width: '100%',
    height: '100%',
  },
  orderSummaryInfoContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 4, // Exact gap from Figma layout_91AERD
  },
  orderSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start', // Align items to the left
  },
  itemCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4C4C4C',
    lineHeight: 20,
  },
  savingsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0, // Icon and "saved" text together with NO gap between them - they should be touching
    marginLeft: 8, // 8px gap between "2 items" and the savings container (icon + saved text)
  },
  savingsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#034703',
    lineHeight: 20,
    marginLeft: 0, // No gap between icon and text - they should be touching
  },
  chevronContainer: {
    marginLeft: 'auto', // Push chevron to the right side
  },
  deliveryAddress: {
    fontSize: 12,
    fontWeight: '400',
    color: '#828282',
    lineHeight: 16,
    marginTop: 4,
  },
  orderItemsContainer: {
    marginTop: 8,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  orderItemImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#DDDDDD',
    overflow: 'hidden',
  },
  orderItemImage: {
    width: '100%',
    height: '100%',
  },
  orderItemInfo: {
    flex: 1,
    gap: 4,
  },
  orderItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  orderItemQuantity: {
    fontSize: 12,
    fontWeight: '400',
    color: '#828282',
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  helpContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    color: '#1A1A1A',
  },
  helpSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#828282',
  },
  mapErrorContainer: {
    width: '100%',
    height: 200,
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
  modifyOrderButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#034703',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modifyOrderButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#034703',
    lineHeight: 20,
  },
});

export default OrderStatusDetails;
