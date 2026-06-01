import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import type { RootStackNavigationProp } from '../../types/navigation';
import Text from '../common/Text';

// Support Center UI – replicates dashboard Support Center look on home (header, quick stats cards, category cards)

const QUICK_ACTIONS = [
  { id: 'contact', label: 'Contact support', sub: 'Get in touch', icon: '💬' },
  { id: 'tickets', label: 'My tickets', sub: 'Track requests', icon: '🎫' },
  { id: 'chat', label: 'Live chat', sub: 'Chat now', icon: '💭' },
  { id: 'faq', label: 'FAQs', sub: 'Quick answers', icon: '❓' },
] as const;

const CATEGORIES: { id: string; name: string; icon: string; helpSection: string }[] = [
  { id: 'order', name: 'Order', icon: '🛒', helpSection: 'Order / Products Related ' },
  { id: 'payment', name: 'Payment', icon: '💳', helpSection: 'Payment Related' },
  { id: 'delivery', name: 'Delivery', icon: '🚚', helpSection: 'Shipping & Delivery' },
  { id: 'account', name: 'Account', icon: '👤', helpSection: 'General Inquiry' },
  { id: 'technical', name: 'Technical', icon: '⚙️', helpSection: 'General Inquiry' },
  { id: 'feedback', name: 'Feedback', icon: '💬', helpSection: 'Feedback & Suggestions' },
];

interface SupportCenterSectionProps {
  title?: string;
  subtitle?: string;
}

export default function SupportCenterSection({
  title = 'Support Center',
  subtitle = 'Get help with orders, payments & more',
}: SupportCenterSectionProps) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { width: screenWidth } = useWindowDimensions();
  const padding = 16;
  const gap = 12;
  const cardWidth = (screenWidth - padding * 2 - gap) / 2;

  const handleQuickAction = () => {
    navigation.navigate('CustomerSupport');
  };

  const handleCategoryPress = () => {
    navigation.navigate('CustomerSupport');
  };

  return (
    <View style={styles.container}>
      {/* Header – same structure as dashboard Support Center */}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.dividerContainer}>
        <LinearGradient
          colors={['rgba(121, 121, 121, 1)', 'rgba(245, 245, 245, 1)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.divider}
        />
      </View>

      {/* Quick stats / action cards – 2x2 grid like dashboard stat cards */}
      <View style={[styles.quickStatsRow, { gap }]}>
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={[styles.statCard, { width: cardWidth }]}
            onPress={handleQuickAction}
            activeOpacity={0.7}
          >
            <View style={styles.statCardTop}>
              <Text style={styles.statLabel}>{action.label}</Text>
              <Text style={styles.statIcon}>{action.icon}</Text>
            </View>
            <Text style={styles.statValue}>{action.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Categories – same idea as dashboard Categories tab */}
      <Text style={styles.categoriesTitle}>Help by category</Text>
      <View style={styles.categoriesGrid}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={styles.categoryCard}
            onPress={handleCategoryPress}
            activeOpacity={0.7}
          >
            <View style={styles.categoryIconWrap}>
              <Text style={styles.categoryIcon}>{cat.icon}</Text>
            </View>
            <Text style={styles.categoryName} numberOfLines={1}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#18181b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#71717a',
    lineHeight: 18,
  },
  dividerContainer: {
    height: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  divider: {
    flex: 1,
    height: 1,
  },
  quickStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  statCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 12,
    color: '#71717a',
    flex: 1,
  },
  statIcon: {
    fontSize: 16,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#18181b',
  },
  categoriesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#18181b',
    marginBottom: 12,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    width: '30%',
    minWidth: 100,
    backgroundColor: '#fcfcfc',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  categoryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f4f4f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryIcon: {
    fontSize: 20,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#18181b',
  },
});
