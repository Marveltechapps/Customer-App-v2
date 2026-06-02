import React, { useState, useCallback } from 'react';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RefundsStackNavigationProp } from '../types/navigation';
import Header from '../components/layout/Header';
import { logger } from '@/utils/logger';
import { fetchRefundDetails, type RefundDetails as RefundDetailsType } from '@/services/refunds/refundsService';

const REFUND_STEPS = [
  { key: 'requested', label: 'Requested' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'processing', label: 'Processing' },
  { key: 'completed', label: 'Completed' },
];

const REFUND_STATUS_ORDER: Record<string, number> = {
  requested: 0, pending: 0,
  under_review: 1,
  approved: 2,
  processing: 3,
  completed: 4,
  rejected: -1,
};

const REASON_CODE_MAP: Record<string, string> = {
  item_damaged: 'Item was damaged',
  expired: 'Item was expired',
  late_delivery: 'Delivery was late',
  wrong_item: 'Wrong item delivered',
  customer_cancelled: 'Cancelled by customer',
  other: 'Other reason',
};

const RefundStatusTimeline: React.FC<{ status: string }> = ({ status }) => {
  const currentIndex = REFUND_STATUS_ORDER[status] ?? 0;
  const isRejected = status === 'rejected';

  return (
    <View style={timelineStyles.container}>
      <View style={timelineStyles.stepsRow}>
        {REFUND_STEPS.map((step, index) => {
          const isCompleted = !isRejected && index < currentIndex;
          const isCurrent = !isRejected && index === currentIndex;
          const isLast = index === REFUND_STEPS.length - 1;

          return (
            <View key={step.key} style={timelineStyles.stepCol}>
              <View style={timelineStyles.dotRow}>
                {index > 0 && (
                  <View style={[timelineStyles.hConnector, (isCompleted || isCurrent) && timelineStyles.hConnectorActive]} />
                )}
                <View style={[
                  timelineStyles.dot,
                  isCompleted && timelineStyles.dotCompleted,
                  isCurrent && timelineStyles.dotCurrent,
                ]} />
                {!isLast && (
                  <View style={[timelineStyles.hConnector, isCompleted && timelineStyles.hConnectorActive]} />
                )}
              </View>
              <Text style={[
                timelineStyles.label,
                (isCompleted || isCurrent) && timelineStyles.labelActive,
              ]}>{step.label}</Text>
            </View>
          );
        })}
      </View>
      {isRejected && (
        <View style={timelineStyles.rejectedBadge}>
          <Text style={timelineStyles.rejectedText}>Rejected</Text>
        </View>
      )}
    </View>
  );
};

const timelineStyles = StyleSheet.create({
  container: { paddingVertical: 8 },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  stepCol: { alignItems: 'center', flex: 1 },
  dotRow: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#D1D1D1' },
  dotCompleted: { backgroundColor: '#034703' },
  dotCurrent: { backgroundColor: '#034703', borderWidth: 2, borderColor: '#D7F1D7' },
  hConnector: { flex: 1, height: 2, backgroundColor: '#D1D1D1' },
  hConnectorActive: { backgroundColor: '#034703' },
  label: { fontSize: 10, fontWeight: '400', color: '#828282', marginTop: 4, textAlign: 'center' },
  labelActive: { color: '#1A1A1A', fontWeight: '500' },
  rejectedBadge: { alignSelf: 'center', backgroundColor: '#FDEAEA', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4, marginTop: 8 },
  rejectedText: { fontSize: 12, fontWeight: '500', color: '#ED0004' },
});

const RefundDetailsScreen: React.FC = () => {
  const navigation = useNavigation<RefundsStackNavigationProp>();
  const route = useRoute();
  const params = route.params as { refundId: string; orderNumber?: string } | undefined;
  const refundId = params?.refundId || '';
  const [refundDetails, setRefundDetails] = useState<RefundDetailsType | null>(null);
  const [loading, setLoading] = useState(false);

  const loadRefundDetails = useCallback(async () => {
    if (!refundId) {
      setRefundDetails(null);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchRefundDetails(refundId);
      setRefundDetails(data ?? null);
    } catch (error) {
      logger.error('Error fetching refund details', error);
      setRefundDetails(null);
    } finally {
      setLoading(false);
    }
  }, [refundId]);

  useRefreshOnFocus(() => {
    void loadRefundDetails();
  }, [loadRefundDetails]);

  const getStatusButtonStyle = () => {
    if (!refundDetails) return { backgroundColor: '#034703', text: 'Completed' };
    switch (refundDetails.status) {
      case 'completed': return { backgroundColor: '#034703', text: 'Completed' };
      case 'rejected': return { backgroundColor: '#ED0004', text: 'Rejected' };
      case 'pending': return { backgroundColor: '#F59E0B', text: 'Pending' };
      default: return { backgroundColor: '#034703', text: 'Completed' };
    }
  };

  const getReasonText = (): string | null => {
    const rd = refundDetails as any;
    if (!rd?.reasonCode) return null;
    return REASON_CODE_MAP[rd.reasonCode] ?? rd.reasonCode;
  };

  const getRefundEta = (): string | null => {
    if (!refundDetails) return null;
    const rd = refundDetails as any;
    const method = rd?.refundMethod ?? rd?.paymentMethod ?? 'wallet';
    if (method === 'wallet') return 'Refund to wallet: Instant';
    return 'Refund to bank: 3-5 business days';
  };

  const headerTitle = refundDetails?.orderNumber ?? params?.orderNumber ?? 'Refund Details';
  const statusButton = getStatusButtonStyle();
  const reasonText = getReasonText();
  const refundEta = getRefundEta();

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Header title={params?.orderNumber ?? 'Refund Details'} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!refundDetails) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Header title={params?.orderNumber ?? 'Refund Details'} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Refund details not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header title={headerTitle} onBackPress={() => navigation.goBack()} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentContainer}>
          {/* Refund Status Timeline (P1-19) */}
          <View style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>Refund Status</Text>
            <RefundStatusTimeline status={refundDetails.status} />
          </View>

          {refundDetails.products.map((product) => (
            <View key={product.id} style={styles.productCard}>
              <View style={styles.productHeader}>
                <View style={styles.productImageContainer}>
                  <View style={styles.productImagePlaceholder}>
                    <Text style={styles.productImageText}>Image</Text>
                  </View>
                </View>
                <View style={styles.productInfo}>
                  <View style={styles.productDetails}>
                    <Text style={styles.productName}>{product.name}</Text>
                    {product.weight ? <Text style={styles.productWeight}>{product.weight}</Text> : null}
                  </View>
                  <View style={styles.productPriceContainer}>
                    <Text style={styles.discountedPrice}>{product.discountedPrice}</Text>
                    {product.originalPrice ? (
                      <Text style={styles.originalPrice}>{product.originalPrice}</Text>
                    ) : null}
                  </View>
                </View>
              </View>
              <View style={styles.detailsSection}>
                <View style={styles.detailRow}>
                  <View style={styles.detailLabelContainer}>
                    <Text style={styles.detailLabel}>Date & Time</Text>
                  </View>
                  <Text style={styles.detailValue}>{refundDetails.dateTime}</Text>
                </View>
                <View style={styles.detailRow}>
                  <View style={styles.detailLabelContainer}>
                    <Text style={styles.detailLabel}>Total item</Text>
                  </View>
                  <Text style={styles.detailValue}>{refundDetails.totalItems}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabelFull}>Refund amount requested</Text>
                  <Text style={styles.detailValueAmount}>{refundDetails.refundAmountRequested}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabelFull}>Refund Approved</Text>
                  <Text style={styles.detailValueAmount}>{refundDetails.refundAmountApproved}</Text>
                </View>
              </View>

              <View style={[styles.statusButton, { backgroundColor: statusButton.backgroundColor }]}>
                <Text style={styles.statusButtonText}>{statusButton.text}</Text>
              </View>

              {/* Reason Code (P1-20) */}
              {reasonText && (
                <View style={styles.reasonContainer}>
                  <Text style={styles.reasonLabel}>Reason:</Text>
                  <Text style={styles.reasonText}>{reasonText}</Text>
                </View>
              )}

              {/* Refund ETA (P1-21) */}
              {refundEta && (
                <View style={styles.etaContainer}>
                  <Text style={styles.etaText}>{refundEta}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', alignItems: 'center' },
  scrollView: { flex: 1, width: '100%' },
  scrollContent: { paddingVertical: 20, paddingHorizontal: 16, paddingBottom: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  loadingText: { fontWeight: '400', fontSize: 14, color: '#828282', textAlign: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  errorText: { fontWeight: '400', fontSize: 14, color: '#ED0004', textAlign: 'center' },
  contentContainer: { gap: 12, width: '100%', alignItems: 'center' },
  timelineCard: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 16, width: '100%' },
  timelineTitle: { fontSize: 14, fontWeight: '500', lineHeight: 20, color: '#1A1A1A', marginBottom: 8 },
  productCard: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 12, paddingBottom: 16, gap: 12, width: '100%', alignSelf: 'stretch' },
  productHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, alignSelf: 'stretch' },
  productImageContainer: { width: 56, height: 56, borderRadius: 8, overflow: 'hidden', backgroundColor: '#E0F2F1', shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  productImagePlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#E0F2F1' },
  productImageText: { fontSize: 10, color: '#6B6B6B' },
  productInfo: { flex: 1, gap: 8 },
  productDetails: { gap: 4 },
  productName: { fontWeight: '500', fontSize: 12, lineHeight: 18, color: '#1A1A1A', textAlign: 'left' },
  productWeight: { fontWeight: '400', fontSize: 12, lineHeight: 16, color: '#6B6B6B', textAlign: 'left' },
  productPriceContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  discountedPrice: { fontWeight: '500', fontSize: 14, lineHeight: 20, color: '#1A1A1A', textAlign: 'left' },
  originalPrice: { fontWeight: '400', fontSize: 12, lineHeight: 16, color: '#6B6B6B', textAlign: 'left', textDecorationLine: 'line-through' },
  detailsSection: { gap: 4, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#D1D1D1', alignSelf: 'stretch' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch' },
  detailLabelContainer: { width: 107.34, height: 16 },
  detailLabel: { fontWeight: '400', fontSize: 12, lineHeight: 18, color: '#6B6B6B', textAlign: 'left' },
  detailValue: { fontWeight: '400', fontSize: 12, lineHeight: 18, color: '#1A1A1A', textAlign: 'right', flex: 1 },
  detailLabelFull: { fontWeight: '400', fontSize: 12, lineHeight: 19.2, color: '#6B6B6B', textAlign: 'left', flex: 1 },
  detailValueAmount: { fontWeight: '400', fontSize: 12, lineHeight: 16, color: '#1A1A1A', textAlign: 'right', width: 22 },
  statusButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end' },
  statusButtonText: { fontWeight: '500', fontSize: 14, lineHeight: 20, color: '#FFFFFF', textAlign: 'center' },
  reasonContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 4 },
  reasonLabel: { fontSize: 12, fontWeight: '500', color: '#6B6B6B' },
  reasonText: { fontSize: 12, fontWeight: '400', color: '#1A1A1A', flex: 1 },
  etaContainer: { backgroundColor: '#F0F7FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4 },
  etaText: { fontSize: 12, fontWeight: '500', color: '#175FBE' },
});

export default RefundDetailsScreen;
