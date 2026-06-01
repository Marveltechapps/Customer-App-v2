/**
 * Coupons Screen
 * 
 * Recreated to match Figma design node-id=12635-17734
 * Shows available coupons with search and apply functionality
 * 
 * Features:
 * - Search input for coupon codes
 * - Apply button for manual coupon entry
 * - Available coupons list with details
 * - Expandable coupon details
 * - Apply coupon functionality
 * 
 * @format
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../components/layout/Header';
import PlusIcon from '../assets/images/plus.svg';
import type { RootStackNavigationProp } from '../types/navigation';
import { couponService, Coupon } from '../services/coupons/couponService';
import { useUser } from '../contexts/UserContext';
import { useLocation } from '../contexts/LocationContext';
import { useCart } from '@/contexts/CartContext';
import { logger } from '@/utils/logger';

const Coupons: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute();
  const { user, userKey } = useUser();
  const { location: contextLocation } = useLocation();
  const { getTotalItems } = useCart();
  
  const [couponCode, setCouponCode] = useState('');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchCouponsList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await couponService.listCoupons({
        user_id: userKey,
        zone: contextLocation?.area || '',
      });
      if (res.success && res.data?.coupons) {
        const filtered = res.data.coupons
          .filter(c => c.showInSections?.includes('COUPON_LIST'))
          .sort((a, b) => (a.priorityRank || 10) - (b.priorityRank || 10));
        setCoupons(filtered);
      }
    } catch (err) {
      logger.warn('Failed to fetch coupons list', err);
    } finally {
      setLoading(false);
    }
  }, [userKey, contextLocation?.area]);

  useEffect(() => {
    fetchCouponsList();
  }, [fetchCouponsList]);

  const handleApplyCoupon = (codeOverride?: string) => {
    const finalCode = (codeOverride || couponCode).trim().toUpperCase();
    if (!finalCode) return;

    const parentNavigation = navigation.getParent();
    if (parentNavigation) {
      (parentNavigation as any).navigate('MainTabs', {
        screen: 'Cart',
        params: {
          appliedCoupon: {
            code: finalCode,
            discount: 0, // Will be validated and calculated on the Cart screen
          },
        },
      });
    } else {
      (navigation as any).navigate('Cart', {
        appliedCoupon: {
          code: finalCode,
          discount: 0,
        },
      });
    }
  };

  const toggleCouponExpansion = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getTimeRemaining = (endDate?: string) => {
    if (!endDate) return null;
    const end = new Date(endDate).getTime();
    const now = new Date().getTime();
    const diff = end - now;
    if (diff <= 0) return 'Expired';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `Expires in ${days}d`;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return `Expires in ${hours}h`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header title="Coupons" />
      
      <FlatList
        data={coupons}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.contentContainer}>
            {/* Search Input Section */}
            <View style={styles.searchSection}>
              <View style={styles.searchInputContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Enter coupon code"
                  placeholderTextColor="#6B6B6B"
                  value={couponCode}
                  onChangeText={setCouponCode}
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  style={styles.applyButton}
                  onPress={() => handleApplyCoupon()}
                  activeOpacity={0.7}
                >
                  <Text style={styles.applyButtonText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Available Coupons Header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available Coupons</Text>
              <View style={styles.dividerLine} />
            </View>
            
            {loading && <ActivityIndicator size="large" color="#034703" style={{ marginTop: 20 }} />}
          </View>
        }
        renderItem={({ item: coupon }) => {
          const isExpanded = expandedIds.has(coupon._id);
          const expiry = getTimeRemaining(coupon.endDate);
          return (
            <View style={[styles.couponCard, { marginHorizontal: 16, marginBottom: 8 }]}>
              <View style={styles.couponHeader}>
                <View style={styles.couponInfo}>
                  <Text style={styles.couponTitle}>{coupon.displayName || `Discount: ${coupon.code}`}</Text>
                  <Text style={styles.couponCode}>Use code {coupon.code}</Text>
                  {expiry && (
                    <Text style={[styles.expiryBadge, expiry === 'Expired' && styles.expiredBadge]}>
                      {expiry}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.couponApplyButton}
                  onPress={() => handleApplyCoupon(coupon.code)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.couponApplyButtonText}>Apply</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.couponBasicInfo}>
                <Text style={styles.couponDescription}>{coupon.description}</Text>
                {coupon.minOrderValue > 0 && (
                  <Text style={styles.minOrderHint}>Min. order value: ₹{coupon.minOrderValue}</Text>
                )}
              </View>

              {isExpanded && (
                <View style={styles.couponDetails}>
                  <Text style={styles.termsTitle}>Terms & Conditions</Text>
                  <Text style={styles.termsText}>
                    {coupon.termsAndConditions || 'Standard terms and conditions apply.'}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.readMoreButton}
                onPress={() => toggleCouponExpansion(coupon._id)}
                activeOpacity={0.7}
              >
                <PlusIcon 
                  width={12} 
                  height={12} 
                  style={{ transform: [{ rotate: isExpanded ? '45deg' : '0deg' }] }} 
                />
                <Text style={styles.readMoreText}>
                  {isExpanded ? 'Read less' : 'Read more'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No coupons available at the moment.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 20,
  },
  searchSection: {
    width: '100%',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D1D1',
    borderRadius: 8.5,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 20,
    padding: 0,
  },
  applyButton: {
    borderWidth: 1,
    borderColor: '#034703',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.31,
    shadowRadius: 4,
    elevation: 2,
  },
  applyButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#034703',
    lineHeight: 18,
  },
  couponsListSection: {
    width: '100%',
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#505050',
    lineHeight: 19.36,
  },
  dividerLine: {
    flex: 1,
    height: 0,
    borderTopWidth: 1,
    borderTopColor: '#797979',
    opacity: 0.5,
  },
  couponsList: {
    gap: 8,
  },
  couponCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  couponHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DDDDDD',
    borderStyle: 'dashed',
  },
  couponInfo: {
    flex: 1,
    gap: 4,
  },
  couponTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4C4C4C',
    lineHeight: 24,
  },
  couponCode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#034703',
    lineHeight: 16,
  },
  expiryBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#E7000B',
    backgroundColor: '#FFE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  expiredBadge: {
    backgroundColor: '#F5F5F5',
    color: '#6B6B6B',
  },
  couponBasicInfo: {
    paddingVertical: 8,
    gap: 4,
  },
  couponDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: '#4C4C4C',
    lineHeight: 18,
  },
  minOrderHint: {
    fontSize: 11,
    fontWeight: '500',
    color: '#828282',
  },
  termsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  termsText: {
    fontSize: 11,
    fontWeight: '400',
    color: '#666666',
    lineHeight: 16,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#828282',
    textAlign: 'center',
  },
  readMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
  },
  couponApplyButton: {
    backgroundColor: '#034703',
    borderWidth: 1,
    borderColor: '#013701',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 3.48, height: 3.48 },
    shadowOpacity: 0.31,
    shadowRadius: 4.64,
    elevation: 3,
  },
  couponApplyButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 16,
  },
  readMoreText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#034703',
    lineHeight: 16,
  },
});

export default Coupons;

