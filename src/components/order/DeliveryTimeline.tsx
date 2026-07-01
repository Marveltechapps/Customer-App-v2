import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

interface TimelineEntry {
  status: string;
  timestamp: string;
  note?: string;
}

interface DeliveryTimelineProps {
  timeline: TimelineEntry[];
  currentStatus: string;
}

const STEPS = [
  { key: 'pending', label: 'Ordered' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'getting-packed', label: 'Packed' },
  { key: 'on-the-way', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
];

const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  placed: 0,
  confirmed: 1,
  'getting-packed': 2,
  packed: 2,
  'on-the-way': 3,
  'out_for_delivery': 3,
  arrived: 3,
  delivered: 4,
  cancelled: -1,
};

const formatTimestamp = (ts: string): string => {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    const h = d.getHours() % 12 || 12;
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
    return `${h}:${m} ${ampm}`;
  } catch {
    return ts;
  }
};

const DeliveryTimeline: React.FC<DeliveryTimelineProps> = ({ timeline, currentStatus }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isCancelled = currentStatus === 'cancelled';
  const currentIndex = STATUS_ORDER[currentStatus] ?? -1;

  useEffect(() => {
    if (isCancelled || currentIndex >= 4) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [currentIndex, isCancelled, pulseAnim]);

  const getTimelineEntry = (stepKey: string): TimelineEntry | undefined => {
    const aliases: Record<string, string[]> = {
      pending: ['pending', 'placed'],
      confirmed: ['confirmed'],
      'getting-packed': ['getting-packed', 'packed'],
      'on-the-way': ['on-the-way', 'out_for_delivery', 'arrived'],
      delivered: ['delivered'],
    };
    const keys = aliases[stepKey] || [stepKey];
    return timeline.find(t => keys.includes(t.status));
  };

  return (
    <View style={styles.container}>
      {STEPS.map((step, index) => {
        const stepIndex = index;
        const isCompleted = !isCancelled && stepIndex < currentIndex;
        const isCurrent = !isCancelled && stepIndex === currentIndex;
        const entry = getTimelineEntry(step.key);
        const isLast = index === STEPS.length - 1;

        return (
          <View key={step.key} style={styles.stepRow}>
            <View style={styles.stepIndicatorCol}>
              {isCompleted ? (
                <View style={styles.completedDot}>
                  <Text style={styles.checkmark}>✓</Text>
                </View>
              ) : isCurrent ? (
                <Animated.View style={[styles.currentDot, { transform: [{ scale: pulseAnim }] }]}>
                  <View style={styles.currentDotInner} />
                </Animated.View>
              ) : isCancelled && step.key === currentStatus ? (
                <View style={styles.cancelledDot}>
                  <Text style={styles.cancelX}>✕</Text>
                </View>
              ) : (
                <View style={styles.futureDot} />
              )}
              {!isLast && (
                <View style={[styles.connector, (isCompleted || isCurrent) && styles.connectorActive]} />
              )}
            </View>
            <View style={styles.stepContent}>
              <Text style={[
                styles.stepLabel,
                (isCompleted || isCurrent) && styles.stepLabelActive,
                isCancelled && step.key === currentStatus && styles.stepLabelCancelled,
              ]}>
                {isCancelled && step.key === 'delivered' ? 'Cancelled' : step.label}
              </Text>
              {entry && (
                <Text style={styles.stepTime}>{formatTimestamp(entry.timestamp)}</Text>
              )}
              {entry?.note ? (
                <Text style={styles.stepNote}>{entry.note}</Text>
              ) : null}
            </View>
          </View>
        );
      })}

      {isCancelled && !STEPS.some(s => s.key === 'cancelled') && (
        <View style={styles.stepRow}>
          <View style={styles.stepIndicatorCol}>
            <View style={styles.cancelledDot}>
              <Text style={styles.cancelX}>✕</Text>
            </View>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepLabelCancelled}>Cancelled</Text>
            {timeline.find(t => t.status === 'cancelled') && (
              <Text style={styles.stepTime}>
                {formatTimestamp(timeline.find(t => t.status === 'cancelled')!.timestamp)}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
  },
  stepRow: {
    flexDirection: 'row',
    minHeight: 48,
  },
  stepIndicatorCol: {
    width: 24,
    alignItems: 'center',
  },
  completedDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#034703',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  currentDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(3, 71, 3, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#034703',
  },
  futureDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#D1D1D1',
    marginTop: 4,
  },
  cancelledDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ED0004',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelX: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  connector: {
    width: 2,
    flex: 1,
    backgroundColor: '#D1D1D1',
    marginVertical: 4,
  },
  connectorActive: {
    backgroundColor: '#034703',
  },
  stepContent: {
    flex: 1,
    marginLeft: 12,
    paddingBottom: 12,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: '#828282',
  },
  stepLabelActive: {
    color: '#1A1A1A',
  },
  stepLabelCancelled: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: '#ED0004',
  },
  stepTime: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: '#828282',
    marginTop: 2,
  },
  stepNote: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: '#6B6B6B',
    marginTop: 2,
  },
});

export default DeliveryTimeline;
