import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, Platform, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '../types/navigation';
import BackButton from '../components/BackButton';
import Text from '../components/common/Text';
import OrderCard from '../components/features/order/OrderCard';
import { Theme } from '../constants/Theme';

type FilterType = 'all' | 'delivered' | 'cancelled';

interface Order {
  id: string;
  status: 'delivered' | 'cancelled';
  date: string;
  price: string;
  images: (string | number)[]; // string for URLs, number for require() assets
  hasRefund?: boolean;
  actionText: string;
}

export default function OrdersScreen() {
  const navigation = useNavigation<RootStackNavigationProp>();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const handleBack = () => {
    navigation.goBack();
  };

  // Order data with images from Figma
  const orders: Order[] = [
    {
      id: '1',
      status: 'delivered',
      date: 'Placed at 21st Jun 2024, 08:50 am',
      price: '₹126',
      images: [
        require('../assets/images/product-image-1.png'),
        require('../assets/images/product-image-2.png'),
      ],
      actionText: 'Rate order',
    },
    {
      id: '2',
      status: 'cancelled',
      date: 'Placed at 21st Jun 2024, 08:50 am',
      price: '₹126',
      images: [
        require('../assets/images/product-image-3.png'),
        require('../assets/images/product-image-4.png'),
      ],
      actionText: 'order again',
    },
    {
      id: '3',
      status: 'delivered',
      date: 'Placed at 21st Jun 2024, 08:50 am',
      price: '₹126',
      images: [
        require('../assets/images/product-image-5.png'),
        require('../assets/images/product-image-6.png'),
      ],
      hasRefund: true,
      actionText: 'order again',
    },
  ];

  const filteredOrders = activeFilter === 'all' 
    ? orders 
    : orders.filter(order => order.status === activeFilter);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Theme.colors.cardBackground} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <BackButton onPress={handleBack} />
          <View style={styles.titleContainer}>
            <Text variant="h3" style={styles.title}>
              My Orders
            </Text>
          </View>
        </View>

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'all' && styles.filterButtonActive]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={StyleSheet.flatten([styles.filterButtonText, activeFilter === 'all' && styles.filterButtonTextActive])}>
              All Orders
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'delivered' && styles.filterButtonActive]}
            onPress={() => setActiveFilter('delivered')}
          >
            <Text style={StyleSheet.flatten([styles.filterButtonText, activeFilter === 'delivered' && styles.filterButtonTextActive])}>
              Delivered
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'cancelled' && styles.filterButtonActive]}
            onPress={() => setActiveFilter('cancelled')}
          >
            <Text style={StyleSheet.flatten([styles.filterButtonText, activeFilter === 'cancelled' && styles.filterButtonTextActive])}>
              Cancelled
            </Text>
          </TouchableOpacity>
        </View>

        {/* Orders List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
    backgroundColor: Theme.colors.cardBackground,
    width: '100%',
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: Theme.colors.text,
    fontFamily: 'Inter',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: Theme.colors.background,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 21,
    borderRadius: 8,
    backgroundColor: Theme.colors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: Theme.colors.primary, // #034703
  },
  filterButtonText: {
    ...Theme.typography.menuItem,
    color: '#6B6B6B',
    textAlign: 'center',
  },
  filterButtonTextActive: {
    color: Theme.colors.cardBackground, // White
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 16,
  },
});

