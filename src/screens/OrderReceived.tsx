/**
 * Order Received Screen
 *
 * Shown when an order's status transitions to "delivered".
 * Displays a confirmation message and allows the user to
 * navigate back to orders or rate the order.
 *
 * @format
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type {
  OrdersStackParamList,
  OrdersStackNavigationProp,
  RootStackNavigationProp,
} from '../types/navigation';
import SuccessBackground from '../assets/images/success-background.svg';
import SuccessIconContainer from '../assets/images/success-icon-container.svg';

type OrderReceivedRouteProp = RouteProp<OrdersStackParamList, 'OrderReceived'>;

const OrderReceived: React.FC = () => {
  const navigation = useNavigation<OrdersStackNavigationProp>();
  const rootNavigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<OrderReceivedRouteProp>();
  const orderId = route.params?.orderId;

  const handleRateOrder = () => {
    if (orderId) {
      navigation.navigate('RateOrder', { orderId });
    } else {
      rootNavigation.navigate('MainTabs');
    }
  };

  const handleGoHome = () => {
    rootNavigation.navigate('MainTabs');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.content}>
        <View style={styles.cardContainer}>
          <View style={styles.backgroundContainer}>
            <SuccessBackground width={350} height={163} />
          </View>

          <View style={styles.innerContent}>
            <View style={styles.iconContainer}>
              <SuccessIconContainer width={122} height={122} />
            </View>

            <View style={styles.messageContainer}>
              <Text style={styles.title}>Order Delivered!</Text>
              <Text style={styles.subtitle}>
                Your order has been successfully delivered. We hope you enjoy your items!
              </Text>
            </View>

            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={styles.rateButton}
                onPress={handleRateOrder}
                activeOpacity={0.7}
              >
                <Text style={styles.rateButtonText}>Rate Order</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.homeButton}
                onPress={handleGoHome}
                activeOpacity={0.7}
              >
                <Text style={styles.homeButtonText}>Back to Home</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cardContainer: {
    width: 350,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 163,
  },
  innerContent: {
    alignItems: 'center',
    paddingTop: 100,
    paddingBottom: 32,
    paddingHorizontal: 32,
    gap: 20,
  },
  iconContainer: {
    width: 122,
    height: 122,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageContainer: {
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    color: '#818181',
    textAlign: 'center',
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  rateButton: {
    width: '100%',
    backgroundColor: '#034703',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  rateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  homeButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#034703',
    alignItems: 'center',
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#034703',
  },
});

export default OrderReceived;
