import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';

interface CouponSectionProps {
  appliedCoupon?: {
    code: string;
    discount: number;
  };
  onApply: (code: string) => void;
  onRemove?: () => void;
  isValidating?: boolean;
  validationError?: string;
}

const CouponSection: React.FC<CouponSectionProps> = ({
  appliedCoupon,
  onApply,
  onRemove,
  isValidating,
  validationError,
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [showInput, setShowInput] = useState(!appliedCoupon);

  const handleApply = () => {
    if (couponCode.trim()) {
      onApply(couponCode.trim());
    }
  };

  const handleRemove = () => {
    setCouponCode('');
    setShowInput(true);
    onRemove?.();
  };

  const handleShowInput = () => {
    setShowInput(true);
    setCouponCode('');
  };

  if (appliedCoupon && !showInput) {
    return (
      <View style={styles.container}>
        <View style={styles.appliedCouponContainer}>
          <View style={styles.appliedCouponInfo}>
            <Text style={styles.appliedCouponLabel}>Coupon Applied</Text>
            <Text style={styles.appliedCouponCode}>{appliedCoupon.code}</Text>
            <Text style={styles.appliedCouponDiscount}>
              -₹{appliedCoupon.discount.toFixed(2)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={handleRemove}
            activeOpacity={0.7}
          >
            <Text style={styles.removeButtonText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            validationError && styles.inputError,
          ]}
          value={couponCode}
          onChangeText={setCouponCode}
          placeholder="Enter coupon code"
          placeholderTextColor="#828282"
          editable={!isValidating}
        />
        <TouchableOpacity
          style={[
            styles.applyButton,
            (!couponCode.trim() || isValidating) && styles.applyButtonDisabled,
          ]}
          onPress={handleApply}
          activeOpacity={0.7}
          disabled={!couponCode.trim() || isValidating}
        >
          <Text style={styles.applyButtonText}>
            {isValidating ? 'Applying...' : 'Apply'}
          </Text>
        </TouchableOpacity>
      </View>
      {validationError && (
        <Text style={styles.errorText}>{validationError}</Text>
      )}
      {appliedCoupon && showInput && (
        <TouchableOpacity
          style={styles.viewAppliedButton}
          onPress={() => setShowInput(false)}
          activeOpacity={0.7}
        >
          <Text style={styles.viewAppliedButtonText}>
            View Applied Coupon
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 0.6,
    borderColor: '#F4F4F4',
    gap: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  applyButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#034703',
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.5,
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#FF3B30',
    lineHeight: 16,
  },
  appliedCouponContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appliedCouponInfo: {
    flex: 1,
    gap: 4,
  },
  appliedCouponLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#828282',
    lineHeight: 16,
  },
  appliedCouponCode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    lineHeight: 20,
  },
  appliedCouponDiscount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#034703',
    lineHeight: 20,
  },
  removeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(3, 71, 3, 0.3)',
  },
  removeButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#034703',
    lineHeight: 18,
  },
  viewAppliedButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  viewAppliedButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#034703',
    lineHeight: 18,
    textDecorationLine: 'underline',
  },
});

export default CouponSection;

