import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import type { RootStackNavigationProp } from '../types/navigation';
import Header from '../components/layout/Header';
import PaymentCard from '../components/PaymentCard';
import { paymentService, type SavedCard } from '../services/payments/paymentService';
import { logger } from '@/utils/logger';

const PaymentManagement: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await paymentService.getSavedMethods();
      if (res.success && res.data) {
        setSavedCards(res.data.filter((m) => m.type === 'card'));
      }
    } catch (error) {
      logger.error('Error fetching payment methods', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useRefreshOnFocus(() => {
    void fetchCards();
  }, [fetchCards]);

  const handleDeleteCard = (card: SavedCard) => {
    Alert.alert('Remove Card', `Remove card ending in ${card.last4}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await paymentService.removeMethod(card.id);
            setSavedCards((prev) => prev.filter((c) => c.id !== card.id));
          } catch {
            Alert.alert('Error', 'Failed to remove card. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header title="Payment management" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cardsContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#034703" />
              <Text style={styles.loadingText}>Loading saved cards...</Text>
            </View>
          ) : savedCards.length > 0 ? (
            savedCards.map((card) => (
              <View key={card.id} style={styles.cardWrapper}>
                <PaymentCard
                  cardType={card.brand || 'Card'}
                  lastFourDigits={card.last4}
                  expiryMonth={card.expiryMonth}
                  expiryYear={card.expiryYear}
                  onDelete={() => handleDeleteCard(card)}
                />
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No payment methods added</Text>
          )}
        </View>
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
    paddingBottom: 20,
  },
  cardsContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 8,
  },
  cardWrapper: {
    width: '100%',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  loadingText: {
    fontWeight: '400',
    fontSize: 14,
    color: '#828282',
  },
  emptyText: {
    fontWeight: '400',
    fontSize: 14,
    color: '#828282',
    textAlign: 'center',
    paddingVertical: 20,
  },
});

export default PaymentManagement;

