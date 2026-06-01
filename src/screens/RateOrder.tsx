import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { OrdersStackNavigationProp } from '../types/navigation';
import Header from '../components/layout/Header';
import RatingSuccess from './RatingSuccess';
import { logger } from '@/utils/logger';

// Dummy static data - Replace with API call later
interface OrderRating {
  orderId: string;
  rating: number;
  comment?: string;
}

const RateOrder: React.FC = () => {
  const navigation = useNavigation<OrdersStackNavigationProp>();
  const route = useRoute();
  const orderId = (route.params as { orderId?: string })?.orderId;
  const [showRatingSuccess, setShowRatingSuccess] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Placeholder for API call - Replace with actual API later
  useEffect(() => {
    const fetchOrderData = async () => {
      setLoading(true);
      try {
        // TODO: Replace with actual API call
        // const response = await fetch(`/api/orders/${orderId}`);
        // const data = await response.json();
        // Pre-fill if order already has rating

        // Using dummy data for now
      } catch (error) {
        logger.error('Error fetching order data', error);
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrderData();
    }
  }, [orderId]);

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleStarPress = (starIndex: number) => {
    setRating(starIndex + 1);
  };

  const handleSubmit = () => {
    if (rating === 0) {
      // Show error - rating is required
      return;
    }

    const orderRating: OrderRating = {
      orderId: orderId || '',
      rating,
      comment: comment.trim() || undefined,
    };

    // TODO: Replace with actual API call
    // await fetch(`/api/orders/${orderId}/rating`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(orderRating),
    // });

    setShowRatingSuccess(true);
  };

  const handleRatingSuccessDone = () => {
    setShowRatingSuccess(false);
    navigation.navigate('MyOrders');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header title="Rate order" />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.ratingContainer}>
          <Text style={styles.ratingLabel}>How was your Order ?</Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => handleStarPress(star - 1)}
                activeOpacity={0.7}
                style={styles.starButton}
              >
                <Text style={[
                  styles.star,
                  star <= rating && styles.starFilled
                ]}>
                  {star <= rating ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.commentContainer}>
          <Text style={styles.commentLabel}>Comments / Suggestion</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Tell us more (if you'd like)… "
            placeholderTextColor="#6B6B6B"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.7}
          disabled={rating === 0}
        >
          <Text style={styles.submitButtonText}>Submit</Text>
        </TouchableOpacity>
      </ScrollView>
      <RatingSuccess
        visible={showRatingSuccess}
        onDone={handleRatingSuccessDone}
        onClose={() => setShowRatingSuccess(false)}
      />
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
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 24,
  },
  ratingContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 10.5,
    gap: 8,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: '#1A1A1A',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 31,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  starButton: {
    padding: 4,
  },
  star: {
    fontSize: 26.2,
    color: '#D4D4D4',
    lineHeight: 25.04,
  },
  starFilled: {
    color: '#FA7500',
  },
  commentContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 10.5,
    gap: 8,
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: '#1A1A1A',
  },
  commentInput: {
    minHeight: 100,
    padding: 11,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#D4D4D4',
    borderRadius: 3.5,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    color: '#1A1A1A',
    backgroundColor: '#F5F5F5',
  },
  submitButton: {
    backgroundColor: '#034703',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: '#FFFFFF',
  },
});

export default RateOrder;

