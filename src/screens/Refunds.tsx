import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { RefundsStackNavigationProp } from '../types/navigation';
import Header from '../components/layout/Header';
import NoRefundsIcon from '../assets/images/no-refunds-icon.svg';
import { logger } from '@/utils/logger';
import { fetchRefunds, type RefundItem } from '@/services/refunds/refundsService';

const Refunds: React.FC = () => {
  const navigation = useNavigation<RefundsStackNavigationProp>();
  const [refunds, setRefunds] = useState<RefundItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadRefunds = async () => {
      setLoading(true);
      try {
        const result = await fetchRefunds(1, 20);
        setRefunds(result.refunds ?? []);
      } catch (error) {
        logger.error('Error fetching refunds', error);
        setRefunds([]);
      } finally {
        setLoading(false);
      }
    };

    loadRefunds();
  }, []);

  const handleViewDetails = useCallback(
    (item: RefundItem) => {
      navigation.navigate('RefundDetails', {
        refundId: item.id,
        orderNumber: item.orderNumber,
      });
    },
    [navigation]
  );

  const keyExtractor = useCallback((item: RefundItem) => item.id, []);

  const renderRefundCard = useCallback(({ item }: { item: RefundItem }) => {
    const getStatusBadgeStyle = () => {
      switch (item.status) {
        case 'completed':
          return { backgroundColor: '#D7F1D7', color: '#2C512C' };
        case 'pending':
          return { backgroundColor: '#FFF4E6', color: '#8B6914' };
        case 'rejected':
          return { backgroundColor: '#FFE6E6', color: '#8B0000' };
        default:
          return { backgroundColor: '#F5F5F5', color: '#666666' };
      }
    };

    const statusBadge = getStatusBadgeStyle();

    return (
      <View style={styles.refundCard}>
        <View style={styles.cardContent}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumber}>{item.orderNumber}</Text>
            <Text style={styles.orderDate}>
              {item.date ? new Date(item.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusBadge.backgroundColor }]}>
            <Text style={[styles.statusText, { color: statusBadge.color }]}>
              {item.statusText}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.viewDetailsButton}
          onPress={() => handleViewDetails(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.viewDetailsText}>View Details</Text>
        </TouchableOpacity>
      </View>
    );
  }, [handleViewDetails]);

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <NoRefundsIcon width={100} height={100} />
      </View>
      <View style={styles.emptyTextContainer}>
        <Text style={styles.emptyTitle}>No Refunds</Text>
      </View>
      <View style={styles.emptyMessageContainer}>
        <Text style={styles.emptyMessage}>You have no active or past refunds.</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header title="Refunds" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : refunds.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.refundsListContainer}>
            <FlatList
              data={refunds}
              renderItem={renderRefundCard}
              keyExtractor={keyExtractor}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontWeight: '400',
    fontSize: 14,
    color: '#828282',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 12,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTextContainer: {
    width: '100%',
    alignItems: 'center',
  },
  emptyTitle: {
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18, // 1.5em
    color: '#666666',
    textAlign: 'center',
  },
  emptyMessageContainer: {
    width: '100%',
    alignItems: 'center',
  },
  emptyMessage: {
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20, // 1.4285714285714286em
    color: '#1A1A1A',
    textAlign: 'center',
  },
  refundsListContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 12,
    width: '100%',
    alignItems: 'center',
  },
  refundCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10.5,
    padding: 16,
    gap: 12,
    width: 353,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  orderInfo: {
    flex: 1,
    gap: 4,
  },
  orderNumber: {
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 24, // 1.5em
    color: '#1A1A1A',
    textAlign: 'left',
  },
  orderDate: {
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18, // 1.5em
    color: '#6B6B6B',
    textAlign: 'left',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 18, // 1.5em
    textAlign: 'center',
  },
  viewDetailsButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 3.5,
    borderWidth: 1,
    borderColor: 'rgba(3, 71, 3, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewDetailsText: {
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 19.2, // 1.6000000635782878em
    color: '#034703',
    textAlign: 'center',
  },
  separator: {
    height: 12,
  },
});

export default Refunds;

