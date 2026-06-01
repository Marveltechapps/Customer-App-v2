import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';

export interface BillSummaryData {
  itemTotal: number;
  itemTotalOriginal?: number;
  gstAmount: number;
  deliveryFee: number;
  handlingCharge: number;
  totalSavings: number;
  deliveryTip?: number;
  couponDiscount?: number;
  couponCode?: string;
  totalBill: number;
}

interface BillSummaryProps {
  data: BillSummaryData;
  isUpdatingTip?: boolean;
}

const BillSummary: React.FC<BillSummaryProps> = ({ data, isUpdatingTip }) => {
  const itemTotalOriginal = data.itemTotalOriginal || data.itemTotal + data.totalSavings;

  const handleInfoPress = () => {
    Alert.alert(
      'Taxes & Fees',
      'GST is calculated based on individual product rates (e.g., 5%, 12%, 18%) as per HSN codes. All product prices are inclusive of GST.',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Bill Summary</Text>
          {data.totalSavings > 0 && (
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsBadgeText}>Saved₹{data.totalSavings.toFixed(0)}</Text>
            </View>
          )}
        </View>
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.contentContainer}>
        <View style={styles.itemTotalRow}>
          <View style={styles.itemTotalLabelContainer}>
            <Text style={styles.itemTotalLabel}>Item Total</Text>
          </View>
          <View style={styles.itemTotalValueContainer}>
            <Text style={styles.itemTotalOriginal}>₹{itemTotalOriginal.toFixed(0)}</Text>
            <Text style={styles.itemTotalDiscounted}>₹{data.itemTotal.toFixed(0)}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.itemTotalLabelContainer}>
            <Text style={styles.label}>GST</Text>
            <TouchableOpacity 
              style={styles.infoIcon} 
              onPress={handleInfoPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.infoIconText}>i</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.value}>₹{data.gstAmount.toFixed(2)}</Text>
        </View>
        
        <View style={styles.row}>
          <Text style={styles.label}>Handling charge</Text>
          <Text style={styles.value}>₹{data.handlingCharge.toFixed(0).padStart(2, '0')}</Text>
        </View>
        
        <View style={styles.row}>
          <Text style={styles.label}>Delivery Fee</Text>
          <Text style={styles.value}>{data.deliveryFee === 0 ? 'Free' : `₹${data.deliveryFee.toFixed(0)}`}</Text>
        </View>
        
        {data.deliveryTip && data.deliveryTip > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Delivery Tip</Text>
            <Text style={styles.value}>₹{data.deliveryTip.toFixed(0)}</Text>
          </View>
        )}
        {data.couponDiscount && data.couponDiscount > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>
              Coupon {data.couponCode ? `(${data.couponCode})` : ''}
            </Text>
            <Text style={[styles.value, styles.couponDiscountValue]}>-₹{data.couponDiscount.toFixed(0)}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total bill</Text>
        <Text style={styles.totalValue}>₹{data.totalBill.toFixed(0)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 0.6,
    borderColor: '#F4F4F4',
  },
  headerContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#D1D1D1',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 20,
  },
  savingsBadge: {
    backgroundColor: '#D7F1D7',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  savingsBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2C512C',
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#D1D1D1',
  },
  contentContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 4,
  },
  itemTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemTotalLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
  },
  itemTotalLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 16,
  },
  infoIcon: {
    width: 9,
    height: 9,
    borderRadius: 33554400,
    backgroundColor: '#E0F2F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoIconText: {
    fontSize: 5.5,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 8.8,
  },
  itemTotalValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
  },
  itemTotalOriginal: {
    fontSize: 10,
    fontWeight: '400',
    color: '#6B6B6B',
    textDecorationLine: 'line-through',
    lineHeight: 14,
    textAlign: 'right',
  },
  itemTotalDiscounted: {
    fontSize: 12,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 19.2,
  },
  value: {
    fontSize: 12,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 18,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    lineHeight: 20,
  },
  couponDiscountValue: {
    color: '#00A85A',
  },
});

export default BillSummary;

