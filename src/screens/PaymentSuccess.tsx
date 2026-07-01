import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { RootStackNavigationProp, RootStackParamList } from '../types/navigation';
import { useCart } from '@/contexts/CartContext';

const PaymentSuccess: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'PaymentSuccess'>>();
  const insets = useSafeAreaInsets();
  const { orderId } = route.params;
  const { clearCart } = useCart();

  useEffect(() => {
    void clearCart();
  }, [clearCart]);

  const goHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs', params: { screen: 'Home' } }],
    });
  };

  const viewReceipt = () => {
    navigation.reset({
      index: 1,
      routes: [
        { name: 'MainTabs', params: { screen: 'Home' } },
        { name: 'Orders' },
      ],
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.inner}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>✓</Text>
        </View>
        <Text style={styles.title}>Payment Successful</Text>
        <Text style={styles.subtitle}>Thank you. Your payment was received.</Text>
        <View style={styles.orderBox}>
          <Text style={styles.orderLabel}>Order ID</Text>
          <Text style={styles.orderValue} selectable>
            {orderId}
          </Text>
        </View>
      </View>
      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={viewReceipt} activeOpacity={0.85}>
          <Text style={styles.secondaryText}>View Receipt</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={goHome} activeOpacity={0.85}>
          <Text style={styles.primaryText}>Continue Shopping</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#034703',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 44,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 20,
  },
  orderBox: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  orderLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6B6B',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  orderValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#034703',
  },
  actions: {
    paddingHorizontal: 20,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: '#034703',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#034703',
  },
  secondaryText: {
    color: '#034703',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PaymentSuccess;
