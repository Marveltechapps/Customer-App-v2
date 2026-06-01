import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import CardIcon from '../assets/images/card-icon.svg';
import DeleteIcon from '../assets/images/delete-icon.svg';

interface PaymentCardProps {
  cardType: string;
  lastFourDigits: string;
  expiryMonth: string;
  expiryYear: string;
  onDelete?: () => void;
}

const PaymentCard: React.FC<PaymentCardProps> = ({
  cardType,
  lastFourDigits,
  expiryMonth,
  expiryYear,
  onDelete,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.contentRow}>
        <View style={styles.cardInfoRow}>
          {/* Card Icon */}
          <View style={styles.cardIconContainer}>
            <CardIcon width={24} height={17} />
          </View>
          
          <View style={styles.cardDetailsContainer}>
            <Text style={styles.cardNumber}>
              {cardType} XXXX {lastFourDigits}
            </Text>
            <Text style={styles.expiryText}>
              Expires on {expiryMonth}/{expiryYear}
            </Text>
          </View>
        </View>
        
        {/* Delete Icon */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={onDelete}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={styles.deleteIconContainer}>
            <DeleteIcon width={24} height={24} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  contentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  cardIconContainer: {
    width: 24,
    height: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardDetailsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  cardNumber: {
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20, // 1.4285714285714286em = ~20px
    color: '#4C4C4C',
    textAlign: 'left',
    marginBottom: 0,
  },
  expiryText: {
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18, // 1.5em = ~18px
    color: '#777777',
    textAlign: 'left',
    marginTop: 0,
  },
  deleteButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default PaymentCard;

