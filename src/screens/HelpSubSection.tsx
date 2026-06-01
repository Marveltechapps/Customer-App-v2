import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { CustomerSupportStackNavigationProp } from '../types/navigation';
import Header from '../components/layout/Header';
import FAQItem from '../components/features/support/FAQItem';
import { logger } from '@/utils/logger';

// Dummy static data - Replace with API call later
const FAQ_DATA: Record<string, Array<{ question: string; answer: string }>> = {
  'General Inquiry': [
    {
      question: 'What is Selorg Organic Grocery Delivery?',
      answer:
        'Selorg is your one-stop app for fresh, organic groceries — delivered straight to your doorstep with zero hassle.',
    },
    {
      question: 'Are your products organic?',
      answer:
        'All our products come directly from certified organic farms and trusted local suppliers who follow clean, sustainable practices.',
    },
    {
      question: 'Do I need to create an account?',
      answer:
        "Yup! You'll need to sign up or log in to browse products, place orders, and track your deliveries.",
    },
  ],
  'Feedback & Suggestions': [
    {
      question: 'How can I provide feedback?',
      answer:
        'You can share your feedback through the app settings, email us directly, or use the feedback form in the support section.',
    },
    {
      question: 'Do you implement user suggestions?',
      answer:
        'Yes! We regularly review user feedback and suggestions to improve our service and app experience.',
    },
  ],
  'Order / Products Related ': [
    {
      question: 'How do I place an order?',
      answer:
        'Simply browse our catalog, add items to your cart, and proceed to checkout. You can choose delivery time and payment method.',
    },
    {
      question: 'Can I modify my order?',
      answer:
        'You can modify your order within 30 minutes of placing it. After that, please contact support for assistance.',
    },
  ],
  'Shipping & Delivery': [
    {
      question: 'What are your delivery options?',
      answer:
        'We offer same-day and scheduled delivery. Delivery times vary by location and are shown at checkout.',
    },
    {
      question: 'Is there a minimum order amount?',
      answer:
        'Yes, we have a minimum order amount of $25 for free delivery. Orders below this amount may incur a delivery fee.',
    },
  ],
  'Payment Related': [
    {
      question: 'What payment methods do you accept?',
      answer:
        'We accept all major credit cards, debit cards, PayPal, and digital wallets like Apple Pay and Google Pay.',
    },
    {
      question: 'Is my payment information secure?',
      answer:
        'Absolutely! We use industry-standard encryption and never store your full payment details on our servers.',
    },
  ],
  'Returns & Exchanges': [
    {
      question: 'What is your return policy?',
      answer:
        'We accept returns within 7 days of delivery for unopened, non-perishable items. Fresh produce cannot be returned.',
    },
    {
      question: 'How do I initiate a return?',
      answer:
        'Go to your order history, select the item you want to return, and follow the return process. Our team will process it within 2-3 business days.',
    },
  ],
  'Coupons & Offers': [
    {
      question: 'How do I apply a coupon code?',
      answer:
        'Enter your coupon code at checkout in the "Promo Code" field. Valid codes will be applied automatically.',
    },
    {
      question: 'Where can I find available offers?',
      answer:
        'Check the "Offers" section in the app, subscribe to our newsletter, or follow us on social media for the latest deals.',
    },
  ],
};

const HelpSubSection: React.FC = () => {
  const navigation = useNavigation<CustomerSupportStackNavigationProp>();
  const route = useRoute();
  const sectionName = (route.params as { sectionName: string })?.sectionName || '';
  // State for API integration (ready for future use)
  const [faqItems, setFaqItems] = useState<Array<{ question: string; answer: string }>>([]);
  const [loading, setLoading] = useState(false);
  // State to track which FAQ item is open (only one at a time)
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Placeholder for API call - Replace with actual API later
  useEffect(() => {
    // Simulate API call
    const fetchFAQData = async () => {
      setLoading(true);
      try {
        // TODO: Replace with actual API call
        // const response = await fetch(`/api/help/${sectionName}`);
        // const data = await response.json();
        // setFaqItems(data.faqItems);

        // Using dummy data for now
        const data = FAQ_DATA[sectionName] || [];
        setFaqItems(data);
      } catch (error) {
        logger.error('Error fetching FAQ data', error);
        // Fallback to dummy data
        setFaqItems(FAQ_DATA[sectionName] || []);
      } finally {
        setLoading(false);
      }
    };

    fetchFAQData();
  }, [sectionName]);


  const handleFAQPress = (index: number) => {
    // If clicking the same item, close it. Otherwise, close previous and open new one
    if (openIndex === index) {
      setOpenIndex(null);
    } else {
      setOpenIndex(index);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header title={sectionName} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.faqContainer}>
          {loading ? (
            <Text style={styles.loadingText}>Loading...</Text>
          ) : faqItems.length > 0 ? (
            faqItems.map((item, index) => (
              <View
                key={index}
                style={[
                  styles.faqItemWrapper,
                  index === faqItems.length - 1 && styles.faqItemWrapperLast,
                ]}
              >
                <FAQItem
                  question={item.question}
                  answer={item.answer}
                  isOpen={openIndex === index}
                  onPress={() => handleFAQPress(index)}
                />
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No FAQs available for this section.</Text>
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
  faqContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  faqItemWrapper: {
    width: '100%',
    marginBottom: 20,
  },
  faqItemWrapperLast: {
    marginBottom: 0,
  },
  loadingText: {
    fontWeight: '400',
    fontSize: 14,
    color: '#828282',
    textAlign: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontWeight: '400',
    fontSize: 14,
    color: '#828282',
    textAlign: 'center',
    paddingVertical: 20,
  },
});

export default HelpSubSection;

