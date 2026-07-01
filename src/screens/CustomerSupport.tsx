import React, { useState } from 'react';
import { useRefreshAppConfigOnFocus } from '../hooks/useRefreshAppConfigOnFocus';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { CustomerSupportStackNavigationProp } from '../types/navigation';
import PhoneIcon from '../assets/images/phone-icon.svg';
import Header from '../components/layout/Header';
import HelpItem from '../components/features/support/HelpItem';
import SupportCard from '../components/features/support/SupportCard';
import { logger } from '@/utils/logger';
import { useAppConfig } from '../contexts/AppConfigContext';

const FALLBACK_HELP_ITEMS = [
  'Contact Support',
  'General Inquiry',
  'Feedback & Suggestions',
  'Order / Products Related',
  'Shipping & Delivery',
  'Payment Related',
  'Returns & Exchanges',
  'Coupons & Offers',
  'Location',
];

const CustomerSupport: React.FC = () => {
  const navigation = useNavigation<CustomerSupportStackNavigationProp>();
  const { appConfig } = useAppConfig();
  const helpItems = (appConfig.supportCategories?.length
    ? appConfig.supportCategories
        .filter((c) => c.isActive !== false)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((c) => c.label)
    : FALLBACK_HELP_ITEMS);
  const [loading, setLoading] = useState(false);

  useRefreshAppConfigOnFocus('CustomerSupport');

  const handleHelpItemPress = (item: string) => {
    // Contact Support opens ticket form (match label from config or fallback)
    const contactLabel = appConfig.supportCategories?.find((c) => c.key === 'contact_support')?.label ?? 'Contact Support';
    if (item === contactLabel || item === 'Contact Support') {
      navigation.navigate('ContactSupport');
      return;
    }
    // Check if this is the Location section
    if (item === 'Location' || item.toLowerCase().includes('location')) {
      // Navigate to Addresses stack (LocationNavigator)
      navigation.getParent()?.navigate('Addresses');
      return;
    }

    // Navigate to HelpSubSection with the section name
    navigation.navigate('HelpSubSection', { sectionName: item });
  };

  const handleChatPress = () => {
    navigation.navigate('GeneralChat');
  };

  const handleCallSupport = () => {
    Linking.openURL(`tel:${appConfig.support?.contactPhone ?? '+919999999999'}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header title="Help & support" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.productListContainer}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Help</Text>
            </View>
            <View style={styles.helpItemsContainer}>
              {loading ? (
                <Text style={styles.loadingText}>Loading...</Text>
              ) : helpItems.length > 0 ? (
                helpItems.map((item, index) => (
                  <View key={index} style={styles.helpItemWrapper}>
                    <HelpItem
                      title={item}
                      onPress={() => handleHelpItemPress(item)}
                    />
                  </View>
                ))
              ) : (
                <Text style={styles.loadingText}>No help categories configured</Text>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Support</Text>
            </View>
            <SupportCard onChatPress={handleChatPress} />
            <TouchableOpacity
              style={styles.callSupportItem}
              onPress={() => navigation.navigate('MySupportTickets')}
              activeOpacity={0.7}
            >
              <View style={styles.callSupportContent}>
                <View style={styles.callIconContainer}>
                  <Text style={styles.ticketIcon}>🎫</Text>
                </View>
                <Text style={styles.callSupportText}>My tickets</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.callSupportItem} onPress={handleCallSupport} activeOpacity={0.7}>
              <View style={styles.callSupportContent}>
                <View style={styles.callIconContainer}>
                  <PhoneIcon width={20} height={20} />
                </View>
                <Text style={styles.callSupportText}>Call Support</Text>
              </View>
            </TouchableOpacity>
          </View>
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
  productListContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  section: {
    width: '100%',
    marginBottom: 20,
  },
  sectionHeader: {
    width: '100%',
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 24, // 1.5em = 24px
    color: '#1A1A1A',
    textAlign: 'left',
  },
  helpItemsContainer: {
    width: '100%',
  },
  callSupportItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    borderWidth: 0.6,
    borderColor: '#F4F4F4',
  },
  callSupportContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  callIconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketIcon: {
    fontSize: 18,
  },
  callSupportText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: '#034703',
  },
  helpItemWrapper: {
    marginBottom: 5,
  },
  loadingText: {
    fontWeight: '400',
    fontSize: 14,
    color: '#828282',
    textAlign: 'center',
    paddingVertical: 20,
  },
});

export default CustomerSupport;

