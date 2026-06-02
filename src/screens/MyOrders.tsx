import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import type { OrdersStackNavigationProp, RootStackNavigationProp } from '../types/navigation';
import Header from '../components/layout/Header';
import { logger } from '@/utils/logger';
import { getOrders, type Order } from '../services/orders/orderService';
import CheckmarkIcon from '../assets/images/checkmark-icon.svg';
import CancelIcon from '../assets/images/cancel-icon.svg';
import ChevronRightIcon from '../assets/images/chevron-right.svg';


type FilterType = 'all' | 'delivered' | 'cancelled' | 'in_progress';

const IN_PROGRESS_STATUSES = ['pending', 'confirmed', 'getting-packed', 'on-the-way', 'arrived'];

const formatDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    const h12 = hours % 12 || 12;
    return `${day} ${month} ${year}, ${h12}:${minutes} ${ampm}`;
  } catch {
    return dateStr;
  }
};

const isOnlinePrepay = (o: Order) =>
  o.paymentMethod?.type === 'card' || o.paymentMethod?.type === 'upi';

const getStatusLabel = (order: Order): string => {
  if (isOnlinePrepay(order) && order.paymentStatus === 'pending' && order.status === 'pending') {
    return 'Awaiting Payment';
  }
  switch (order.status) {
    case 'delivered': return 'Order Delivered';
    case 'cancelled': return 'Order Cancelled';
    case 'pending': return 'Order Pending';
    case 'confirmed': return 'Order Confirmed';
    case 'getting-packed': return 'Getting Packed';
    case 'on-the-way': return 'On the Way';
    case 'arrived': return 'Order Arrived';
    default: return 'Order';
  }
};

type FetchOptions = { showLoading?: boolean; useRefreshing?: boolean };

const MyOrders: React.FC = () => {
  const navigation = useNavigation<OrdersStackNavigationProp>();
  const rootNavigation = useNavigation<RootStackNavigationProp>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async (opts: FetchOptions = {}) => {
    const { showLoading = true, useRefreshing = false } = opts;
    if (showLoading) setLoading(true);
    if (useRefreshing) setRefreshing(true);
    setError(null);
    try {
      const response = await getOrders();
      const raw = (response as any)?.data?.data ?? (response as any)?.data ?? [];
      const mapped: Order[] = (Array.isArray(raw) ? raw : []).map((o: any) => ({
        ...o,
        id: o.id ?? o._id ?? '',
      }));
      setOrders(mapped);
    } catch (err) {
      logger.error('Error fetching orders', err);
      setError('Failed to load orders. Pull down to retry.');
      setOrders([]);
    } finally {
      if (showLoading) setLoading(false);
      if (useRefreshing) setRefreshing(false);
    }
  }, []);

  const isFirstFocus = useRef(true);

  // Fetch on every focus: show loading only on first focus; refetch in background on subsequent focus so cancellations from dashboard are reflected
  useRefreshOnFocus(() => {
    const showLoading = isFirstFocus.current;
    if (isFirstFocus.current) isFirstFocus.current = false;
    void fetchOrders({ showLoading });
  }, [fetchOrders]);

  const handleOrderPress = useCallback((order: Order) => {
    try {
      if (order.status === 'cancelled') {
        navigation.navigate('OrderCanceledDetails', { orderId: order.id });
      } else if (order.status === 'delivered') {
        navigation.navigate('OrderSuccessfulDetails', { orderId: order.id });
      } else {
        navigation.navigate('OrderStatusMain');
      }
    } catch (err) {
      logger.error('Navigation error', err);
    }
  }, [navigation]);

  const handleRateOrder = useCallback((order: Order) => {
    navigation.navigate('RateOrder', { orderId: order.id });
  }, [navigation]);

  const handleOrderAgain = useCallback(
    async (_order: Order) => {
      try {
        logger.info('Order again', { orderId: _order.id });
        const { reorderItems } = require('../services/orders/orderService');
        await reorderItems(_order.id);
        rootNavigation.navigate('MainTabs', { screen: 'Cart' });
      } catch (err) {
        logger.error('Reorder failed', err);
        rootNavigation.navigate('MainTabs', { screen: 'Home' });
      }
    },
    [rootNavigation]
  );

  const filteredOrders = useMemo(() => {
    if (filter === 'all') return orders;
    if (filter === 'in_progress') {
      return orders.filter(o => IN_PROGRESS_STATUSES.includes(o.status));
    }
    return orders.filter(o => o.status === filter);
  }, [orders, filter]);

  const handleFilterAll = useCallback(() => setFilter('all'), []);
  const handleFilterDelivered = useCallback(() => setFilter('delivered'), []);
  const handleFilterCancelled = useCallback(() => setFilter('cancelled'), []);
  const handleFilterInProgress = useCallback(() => setFilter('in_progress'), []);
  const keyExtractor = useCallback((item: Order) => item.id, []);

  const renderOrderCard = useCallback(({ item }: { item: Order }) => {
    const isDelivered = item.status === 'delivered';
    const isCancelled = item.status === 'cancelled';
    const isInProgress = IN_PROGRESS_STATUSES.includes(item.status);
    const hasRating = !!item.ratingScore && item.ratingScore > 0;

    return (
      <View style={styles.orderCardContainer}>
        <View style={styles.cardWrapper}>
          <TouchableOpacity
            style={styles.orderCard}
            onPress={() => handleOrderPress(item)}
            activeOpacity={0.7}
          >
            <View style={styles.orderContent}>
              <View style={styles.topSectionContainer}>
                <View style={styles.productImagesContainer}>
                  {(item.items ?? []).slice(0, 3).map((product, index) => (
                    <View
                      key={product.id || index}
                      style={[
                        styles.productImageWrapper,
                        index > 0 && { marginLeft: 8 }
                      ]}
                    >
                      {product.image ? (
                        <Image
                          source={{ uri: product.image }}
                          style={styles.productImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.productImage} />
                      )}
                    </View>
                  ))}
                </View>
                <View style={styles.deliveryInfoContainer}>
                  <View style={styles.orderInfoTop}>
                    <View style={styles.orderTitleRow}>
                      <Text style={styles.orderTitle}>
                        {getStatusLabel(item)}
                      </Text>
                      <View style={styles.statusIcon}>
                        {isDelivered ? (
                          <CheckmarkIcon width={16} height={16} />
                        ) : isCancelled ? (
                          <CancelIcon width={16} height={16} />
                        ) : (
                          <View style={styles.inProgressDot} />
                        )}
                      </View>
                    </View>
                    <Text style={styles.orderDate}>Placed at {formatDate(item.createdAt)}</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>₹{item.totalBill}</Text>
                    <View style={styles.chevronContainer}>
                      <ChevronRightIcon width={16} height={16} />
                    </View>
                  </View>
                </View>
              </View>
              {item.refundStatus === 'completed' && (
                <View style={styles.refundBadge}>
                  <Text style={styles.refundText}>Refund completed</Text>
                </View>
              )}
              {isInProgress && (
                <View style={styles.inProgressBadge}>
                  <Text style={styles.inProgressText}>In Progress</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.orderAction}>
            {isDelivered && hasRating ? (
              <View style={styles.ratingContainer}>
                <Text style={styles.ratedText}>You rated  : </Text>
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <View key={star} style={styles.starContainer}>
                      <Text style={styles.star}>
                        {star <= (item.ratingScore ?? 0) ? '★' : '☆'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : isDelivered && !hasRating ? (
              <TouchableOpacity
                onPress={() => handleRateOrder(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.rateOrderText}>Rate Order</Text>
              </TouchableOpacity>
            ) : isCancelled ? (
              <TouchableOpacity
                onPress={() => handleOrderAgain(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.orderAgainText}>Order Again</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    );
  }, [handleOrderPress, handleRateOrder, handleOrderAgain]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Header title="My Orders" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#034703" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header title="My Orders" />
      
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={handleFilterAll}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]} numberOfLines={1}>
            All Orders
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'in_progress' && styles.filterButtonActive]}
          onPress={handleFilterInProgress}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterText, filter === 'in_progress' && styles.filterTextActive]} numberOfLines={1}>
            In Progress
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'delivered' && styles.filterButtonActive]}
          onPress={handleFilterDelivered}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterText, filter === 'delivered' && styles.filterTextActive]} numberOfLines={1}>
            Delivered
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'cancelled' && styles.filterButtonActive]}
          onPress={handleFilterCancelled}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterText, filter === 'cancelled' && styles.filterTextActive]} numberOfLines={1}>
            Cancelled
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredOrders}
        renderItem={renderOrderCard}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchOrders({ showLoading: false, useRefreshing: true })}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {error || 'No orders found'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    gap: 8,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  filterButtonActive: {
    backgroundColor: '#034703',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: '#6B6B6B',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  orderCardContainer: {
    width: '100%',
    marginBottom: 16,
  },
  cardWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 0.6,
    borderColor: '#F4F4F4',
    overflow: 'hidden',
    width: '100%',
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  orderContent: {
    flexDirection: 'column',
  },
  topSectionContainer: {
    flexDirection: 'column',
    marginBottom: 12,
  },
  productImagesContainer: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  productImageWrapper: {
    width: 40,
    height: 40,
    backgroundColor: '#E0F2F1',
    borderRadius: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productImage: {
    width: 40,
    height: 40,
  },
  deliveryInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  orderInfoTop: {
    flex: 1,
  },
  orderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderTitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: '#1A1A1A',
  },
  statusIcon: {
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inProgressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FA7500',
  },
  orderDate: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: '#828282',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    justifyContent: 'center',
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    color: '#1A1A1A',
  },
  chevronContainer: {
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refundBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#D7F1D7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 12,
  },
  refundText: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    color: '#2C512C',
  },
  inProgressBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 12,
  },
  inProgressText: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    color: '#E65100',
  },
  orderAction: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#D1D1D1',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  rateOrderText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    color: '#FA7500',
  },
  orderAgainText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    color: '#FA7500',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratedText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    color: '#1A1A1A',
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  starContainer: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  star: {
    fontSize: 16,
    color: '#FA7500',
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#828282',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#828282',
    textAlign: 'center',
  },
});

export default MyOrders;
