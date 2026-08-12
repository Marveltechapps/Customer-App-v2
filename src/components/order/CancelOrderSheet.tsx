/**
 * Cancel order sheet — reason picker + can-cancel eligibility.
 * Mirrors web CancelOrderModal (API: GET can-cancel, POST cancel with reason).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Pressable,
} from 'react-native';
import {
  cancelOrder,
  fetchCanCancel,
  type CanCancelResult,
} from '../../services/orders/orderService';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { logger } from '@/utils/logger';

const DEFAULT_REASONS = [
  'Ordered by mistake',
  'Delivery is taking too long',
  'Found a better price elsewhere',
  'Want to change items or address',
  'Other reason',
];

type Props = {
  visible: boolean;
  orderId: string;
  onClose: () => void;
  onCancelled: (message: string) => void;
};

export default function CancelOrderSheet({ visible, orderId, onClose, onCancelled }: Props) {
  const { appConfig } = useAppConfig();
  const [reason, setReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingEligibility, setLoadingEligibility] = useState(false);
  const [eligibility, setEligibility] = useState<CanCancelResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reasons = useMemo(() => {
    const fromConfig = appConfig.checkout?.cancelReasons;
    if (!Array.isArray(fromConfig)) return DEFAULT_REASONS;
    const filtered = fromConfig.filter((r) => typeof r === 'string' && r.trim());
    return filtered.length > 0 ? filtered : DEFAULT_REASONS;
  }, [appConfig.checkout]);

  useEffect(() => {
    if (!visible || !orderId) return;
    let cancelled = false;
    setReason(null);
    setError(null);
    setEligibility(null);
    setLoadingEligibility(true);
    (async () => {
      try {
        const res = await fetchCanCancel(orderId);
        if (cancelled) return;
        if (res.success && res.data) {
          setEligibility(res.data);
          if (!res.data.allowed) {
            setError(
              res.data.reason ||
                'This order can no longer be cancelled. Please contact support for help.'
            );
          }
        } else {
          setEligibility({ allowed: true });
        }
      } catch (err) {
        logger.warn('can-cancel check failed', err);
        if (!cancelled) {
          // Allow attempt; server will enforce on cancel.
          setEligibility({ allowed: true });
        }
      } finally {
        if (!cancelled) setLoadingEligibility(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, orderId]);

  const handleConfirm = async () => {
    if (!reason || !orderId) return;
    if (eligibility && !eligibility.allowed) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await cancelOrder(orderId, reason);
      if (!res.success) {
        throw new Error(
          (res as { error?: string; message?: string }).error ||
            (res as { message?: string }).message ||
            'Could not cancel this order.'
        );
      }
      const refundAmount = Number((res.data as { refundAmount?: number })?.refundAmount || 0);
      const paymentType = String(
        (res.data as { paymentMethod?: { type?: string } })?.paymentMethod?.type || ''
      ).toLowerCase();
      const isCash = paymentType === 'cash' || paymentType === 'cod';
      let message = 'Order cancelled successfully';
      if (!isCash && refundAmount > 0) {
        message = `${message}. Your refund of ₹${refundAmount.toFixed(2)} will be processed to your original payment method in 3–5 business days.`;
      }
      onCancelled(message);
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not cancel this order. Please try again.';
      setError(msg);
      logger.error('Cancel order failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  const fee = eligibility?.cancellationFee;
  const freeMins = eligibility?.freeWindowMinutes;
  const canSubmit =
    !!reason &&
    !submitting &&
    !loadingEligibility &&
    (eligibility?.allowed !== false);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Cancel this order?</Text>
          <Text style={styles.subtitle}>
            Please tell us why you&apos;re cancelling. This helps us improve.
          </Text>

          {loadingEligibility ? (
            <ActivityIndicator color="#034703" style={{ marginVertical: 16 }} />
          ) : (
            <>
              {eligibility?.allowed && (fee != null || freeMins != null) ? (
                <Text style={styles.feeHint}>
                  {fee != null && fee > 0
                    ? `A cancellation fee of ₹${Number(fee).toFixed(2)} may apply.`
                    : freeMins != null
                      ? `Free cancellation within ${freeMins} minutes of placing the order.`
                      : 'You can cancel this order at no extra charge.'}
                </Text>
              ) : null}

              <ScrollView style={styles.reasonList} showsVerticalScrollIndicator={false}>
                {reasons.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.reasonBtn, reason === r && styles.reasonBtnActive]}
                    onPress={() => setReason(r)}
                    disabled={eligibility?.allowed === false}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.reasonText, reason === r && styles.reasonTextActive]}
                    >
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[styles.confirmBtn, !canSubmit && styles.confirmBtnDisabled]}
            onPress={() => void handleConfirm()}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.confirmText}>Confirm Cancellation</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.dismissBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.dismissText}>Keep order</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 10,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D0D0D0',
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  feeHint: {
    fontSize: 12,
    color: '#034703',
    backgroundColor: '#eaf5e8',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  reasonList: {
    maxHeight: 280,
    marginBottom: 12,
  },
  reasonBtn: {
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  reasonBtnActive: {
    borderColor: '#0b5d18',
    backgroundColor: '#eaf5e8',
  },
  reasonText: {
    fontSize: 13,
    color: '#333',
  },
  reasonTextActive: {
    fontWeight: '600',
    color: '#0b5d18',
  },
  error: {
    fontSize: 13,
    color: '#ED0004',
    marginBottom: 10,
  },
  confirmBtn: {
    height: 50,
    borderRadius: 11,
    backgroundColor: '#ED0004',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.45,
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  dismissBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dismissText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
});
