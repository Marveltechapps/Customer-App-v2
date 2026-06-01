import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { OrdersStackNavigationProp, RootStackNavigationProp } from '../types/navigation';
import Header from '../components/layout/Header';
import DeliveryTimeline from '../components/order/DeliveryTimeline';
import { getOrderById, type Order } from '../services/orders/orderService';
import ChatIcon from '../assets/images/chat-icon.svg';
import PhoneIcon from '../assets/images/phone-icon.svg';
import { logger } from '@/utils/logger';
import { useAppConfig } from '../contexts/AppConfigContext';
import { getEnvConfigSafe } from '../config/env';
import { tokenManager } from '../services/api/tokenManager';

const PRODUCT_IMAGE_FALLBACK = require('../assets/images/product-image-1.png');

const formatDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}, ${(d.getHours() % 12 || 12).toString().padStart(2, '0')}.${d.getMinutes().toString().padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
  } catch {
    return dateStr;
  }
};

const formatAddress = (addr: Order['deliveryAddress']): string => {
  if (!addr) return 'N/A';
  if (typeof addr === 'string') return addr;
  const parts = [addr.line1, addr.line2, addr.address, addr.city, addr.state, addr.pincode].filter(Boolean);
  return parts.join(', ') || 'N/A';
};

const OrderCanceledDetails: React.FC = () => {
  const navigation = useNavigation<OrdersStackNavigationProp>();
  const rootNavigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute();
  const { appConfig } = useAppConfig();
  const orderId = (route.params as { orderId?: string })?.orderId;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!orderId) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      try {
        const response = await getOrderById(orderId);
        const o = (response as any)?.data ?? response;
        if (o) {
          setOrder({ ...o, id: o.id ?? o._id ?? orderId });
        } else {
          setError('Order not found');
        }
      } catch (err) {
        logger.error('Error fetching order details', err);
        setError('Failed to load order details');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [orderId]);

  const [callLogs, setCallLogs] = useState<Array<{ id: string; direction: string; duration: number; status: string; callerType: string; createdAt: string }>>([]);

  useEffect(() => {
    if (!orderId) return;
    const fetchCallLogs = async () => {
      try {
        const baseUrl = getEnvConfigSafe().apiBaseUrl.replace(/\/customer\/?$/, '');
        const token = await tokenManager.getAccessToken();
        const res = await fetch(`${baseUrl}/shared/call-logs/by-order/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setCallLogs(json.data ?? json.callLogs ?? []);
        }
      } catch (err) {
        logger.error('Failed to fetch call logs', err);
      }
    };
    fetchCallLogs();
  }, [orderId]);

  const handleOrderAgain = () => {
    logger.info('Order again pressed');
    rootNavigation.navigate('MainTabs', { screen: 'Home' });
  };

  const handleNeedHelp = () => {
    rootNavigation.navigate('CustomerSupport', { orderId });
  };

  const handleCallSupport = () => {
    Linking.openURL(`tel:${appConfig.support?.contactPhone ?? '+919999999999'}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Header title="Order Details" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#034703" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Header title="Order Details" />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{error || 'Order not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const refundMessage = order.refundStatus && order.refundAmount
    ? `Refund of ₹${order.refundAmount} is ${order.refundStatus}.`
    : order.cancellationReason
      ? `Reason: ${order.cancellationReason}. Any amount debited will be refunded within 3-5 days.`
      : 'Your Payment was not completed. Any amount if debited will get refunded within 3-5 days.';

  const itemTotal = order.itemTotal ?? 0;
  const handlingCharge = order.handlingCharge ?? 0;
  const deliveryFee = appConfig.checkout?.deliveryFee ?? 0;
  const totalBill = Math.max(0, itemTotal + handlingCharge + deliveryFee - (order.discount ?? 0));
  const discount = order.discount ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header title="Order Details" />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusContainer}>
          <Text style={styles.statusMessage}>{refundMessage}</Text>
        </View>

        <Text style={styles.actionText}>Please try placing the order again !</Text>

        {order.timeline && order.timeline.length > 0 && (
          <View style={styles.timelineContainer}>
            <DeliveryTimeline timeline={order.timeline} currentStatus={order.status} />
          </View>
        )}

        <View style={styles.orderSummaryContainer}>
          <Text style={styles.orderSummaryTitle}>
            {order.items.length} Items in Order
          </Text>
          {order.items.map((product, index) => (
            <View key={product.id || index} style={styles.productItem}>
              <View style={styles.productImageWrapper}>
                <Image
                  source={product.image ? { uri: product.image } : PRODUCT_IMAGE_FALLBACK}
                  style={styles.productImage}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product.productName}</Text>
                {product.variantSize ? (
                  <Text style={styles.productWeight}>{product.variantSize}</Text>
                ) : null}
                <View style={styles.productPriceRow}>
                  <Text style={styles.productPrice}>₹{product.price}</Text>
                  {product.originalPrice && product.originalPrice !== product.price ? (
                    <Text style={styles.productOriginalPrice}>₹{product.originalPrice}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.billSummaryContainer}>
          <View style={styles.billSummaryHeader}>
            <Text style={styles.billSummaryTitle}>Bill Summary</Text>
            {discount > 0 && (
              <View style={styles.savedBadge}>
                <Text style={styles.savedText}>Saved ₹{discount}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.billSummaryRow}>
            <View style={styles.billSummaryLabelRow}>
              <Text style={styles.billSummaryLabel}>Item Total & GST</Text>
              <View style={styles.infoIcon}>
                <Text style={styles.infoIconText}>i</Text>
              </View>
            </View>
            <Text style={styles.billSummaryValue}>₹{itemTotal}</Text>
          </View>

          <View style={styles.billSummaryRow}>
            <Text style={styles.billSummaryLabel}>Handling charge</Text>
            <Text style={styles.billSummaryValue}>₹{handlingCharge.toString().padStart(2, '0')}</Text>
          </View>

          <View style={styles.billSummaryRow}>
            <Text style={styles.billSummaryLabel}>Delivery Fee</Text>
            <Text style={styles.billSummaryValue}>{deliveryFee === 0 ? 'Free' : `₹${deliveryFee}`}</Text>
          </View>

          <View style={styles.totalBillRow}>
            <Text style={styles.totalBillLabel}>Total bill</Text>
            <Text style={styles.totalBillValue}>₹{totalBill}</Text>
          </View>
        </View>

        <View style={styles.orderDetailsCard}>
          <Text style={styles.orderDetailsTitle}>Order Details</Text>
          <View style={styles.orderDetailsRow}>
            <Text style={styles.orderDetailsLabel}>Order ID</Text>
            <Text style={styles.orderDetailsValue}>#{order.orderNumber || order.id}</Text>
          </View>
          <View style={styles.orderDetailsRow}>
            <Text style={styles.orderDetailsLabel}>Delivery Address</Text>
            <Text style={styles.orderDetailsValue}>{formatAddress(order.deliveryAddress)}</Text>
          </View>
          <View style={styles.orderDetailsRow}>
            <Text style={styles.orderDetailsLabel}>Order Placed</Text>
            <Text style={styles.orderDetailsValue}>{formatDate(order.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.helpRow}>
          <TouchableOpacity style={styles.helpCard} onPress={handleNeedHelp} activeOpacity={0.7}>
            <View style={styles.helpCardContent}>
              <View style={styles.helpIconContainer}>
                <ChatIcon width={40} height={40} />
              </View>
              <View style={styles.helpTextContainer}>
                <Text style={styles.helpTitle}>Need help with this order?</Text>
                <Text style={styles.helpMessage}>Chat with us now — we're just a tap away</Text>
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.callButton} onPress={handleCallSupport} activeOpacity={0.7}>
            <PhoneIcon width={20} height={20} />
          </TouchableOpacity>
        </View>

        {callLogs.length > 0 && (
          <View style={styles.callHistoryCard}>
            <Text style={styles.callHistoryTitle}>Call History</Text>
            {callLogs.map((log, idx) => (
              <View key={log.id || idx} style={styles.callLogRow}>
                <View style={styles.callLogInfo}>
                  <Text style={styles.callLogType}>{log.direction === 'outbound' ? 'Outgoing' : 'Incoming'} Call</Text>
                  <Text style={styles.callLogMeta}>
                    {log.status} · {log.duration ? `${Math.ceil(log.duration / 60)}m` : '0m'} · {log.callerType || 'support'}
                  </Text>
                </View>
                <Text style={styles.callLogTime}>
                  {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.fixedActionsContainer}>
        <TouchableOpacity
          style={styles.orderAgainButton}
          onPress={handleOrderAgain}
          activeOpacity={0.7}
        >
          <Text style={styles.orderAgainButtonText}>Order Again</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', alignItems: 'center' },
  scrollView: { flex: 1, width: '100%' },
  scrollContent: { paddingBottom: 20 },
  orderDetailsCard: { backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 8 },
  orderDetailsTitle: { fontSize: 16, fontWeight: '400', lineHeight: 24, color: '#1A1A1A', marginBottom: 12 },
  orderDetailsRow: { flexDirection: 'column', marginBottom: 12 },
  orderDetailsLabel: { fontSize: 14, fontWeight: '500', lineHeight: 20, color: '#4C4C4C' },
  orderDetailsValue: { fontSize: 12, fontWeight: '400', lineHeight: 18, color: '#4E4E4E' },
  helpRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, gap: 8, alignItems: 'stretch' },
  helpCard: { flex: 1, backgroundColor: '#FFFFFF', padding: 16, borderRadius: 8, borderWidth: 0.6, borderColor: '#F4F4F4' },
  helpCardContent: { flexDirection: 'row', alignItems: 'flex-start' },
  helpIconContainer: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  helpTextContainer: { flex: 1 },
  helpTitle: { fontSize: 14, fontWeight: '500', lineHeight: 20, color: '#1A1A1A' },
  helpMessage: { fontSize: 12, fontWeight: '400', lineHeight: 16, color: '#828282', marginTop: 4 },
  callButton: { backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 0.6, borderColor: '#F4F4F4', width: 52, justifyContent: 'center', alignItems: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontWeight: '400', color: '#828282' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 14, fontWeight: '400', color: '#828282' },
  statusContainer: { backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 8 },
  statusHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statusIconContainer: { marginRight: 8 },
  statusText: { fontSize: 16, fontWeight: '600', lineHeight: 22.4, color: '#1A1A1A' },
  statusMessage: { fontSize: 14, fontWeight: '400', lineHeight: 20, color: '#828282' },
  actionText: { fontSize: 16, fontWeight: '600', lineHeight: 22.4, color: '#FA7500', marginHorizontal: 16, marginTop: 12 },
  timelineContainer: { marginHorizontal: 16, marginTop: 12 },
  orderSummaryContainer: { backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 8 },
  orderSummaryTitle: { fontSize: 14, fontWeight: '500', lineHeight: 20, color: '#1A1A1A' },
  productItem: { flexDirection: 'row', marginTop: 12 },
  productImageWrapper: { width: 60, height: 60, backgroundColor: '#E0F2F1', borderRadius: 8, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  productImage: { width: 60, height: 60 },
  productInfo: { flex: 1, justifyContent: 'space-between', marginLeft: 12 },
  productName: { fontSize: 14, fontWeight: '500', lineHeight: 20, color: '#1A1A1A', marginBottom: 4 },
  productWeight: { fontSize: 12, fontWeight: '400', lineHeight: 16, color: '#828282', marginBottom: 4 },
  productPriceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  productPrice: { fontSize: 14, fontWeight: '600', lineHeight: 20, color: '#1A1A1A' },
  productOriginalPrice: { fontSize: 12, fontWeight: '400', lineHeight: 16, color: '#828282', textDecorationLine: 'line-through', marginLeft: 8 },
  billSummaryContainer: { backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 8 },
  billSummaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F4F4F4', marginBottom: 12 },
  billSummaryTitle: { fontSize: 14, fontWeight: '500', lineHeight: 20, color: '#1A1A1A' },
  savedBadge: { backgroundColor: '#E0F2F1', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  savedText: { fontSize: 12, fontWeight: '500', lineHeight: 16, color: '#00A85A' },
  billSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  billSummaryLabelRow: { flexDirection: 'row', alignItems: 'center' },
  billSummaryLabel: { fontSize: 12, fontWeight: '400', lineHeight: 16, color: '#828282' },
  infoIcon: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#F4F4F4', justifyContent: 'center', alignItems: 'center', marginLeft: 4 },
  infoIconText: { fontSize: 10, fontWeight: '600', color: '#1A1A1A' },
  billSummaryValue: { fontSize: 12, fontWeight: '400', lineHeight: 16, color: '#1A1A1A' },
  totalBillRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F4F4F4' },
  totalBillLabel: { fontSize: 14, fontWeight: '500', lineHeight: 20, color: '#1A1A1A' },
  totalBillValue: { fontSize: 16, fontWeight: '600', lineHeight: 22.4, color: '#1A1A1A' },
  fixedActionsContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 24, borderTopWidth: 1, borderTopColor: '#F4F4F4', shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 5 },
  orderAgainButton: { backgroundColor: '#034703', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  orderAgainButtonText: { fontSize: 14, fontWeight: '500', lineHeight: 20, color: '#FFFFFF' },
  callHistoryCard: { backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 8 },
  callHistoryTitle: { fontSize: 14, fontWeight: '500', lineHeight: 20, color: '#1A1A1A', marginBottom: 12 },
  callLogRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F4F4F4' },
  callLogInfo: { flex: 1 },
  callLogType: { fontSize: 13, fontWeight: '500', color: '#1A1A1A' },
  callLogMeta: { fontSize: 12, fontWeight: '400', color: '#828282', marginTop: 2 },
  callLogTime: { fontSize: 12, fontWeight: '400', color: '#828282' },
});

export default OrderCanceledDetails;
