import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useRefreshAppConfigOnFocus } from '../hooks/useRefreshAppConfigOnFocus';
import type { RootStackNavigationProp } from '../types/navigation';
import Header from '../components/layout/Header';
import ChevronRightIcon from '../assets/images/chevron-right.svg';
import { logger } from '@/utils/logger';
import OrdersIcon from '../assets/images/orders-icon.svg';
import CustomerSupportIcon from '../assets/images/customer-support-icon.svg';
import AddressesIcon from '../assets/images/addresses-icon.svg';
import RefundsIcon from '../assets/images/refunds-icon.svg';
import ProfileIcon from '../assets/images/profile-icon.svg';
import PaymentManagementIcon from '../assets/images/payment-management-icon.svg';
import GeneralInfoIcon from '../assets/images/general-info-icon.svg';
import NotificationsIcon from '../assets/images/notifications-icon.svg';
import { useUser } from '../contexts/UserContext';
import { tokenManager } from '../services/api/tokenManager';

interface SettingsItem {
  id: string;
  title: string;
  icon: React.ComponentType<{ width?: number; height?: number }>;
}

const SETTINGS_ITEMS: SettingsItem[] = [
  { id: 'orders', title: 'Orders', icon: OrdersIcon },
  { id: 'customer-support', title: 'Customer Support & FAQ', icon: CustomerSupportIcon },
  { id: 'addresses', title: 'Addresses', icon: AddressesIcon },
  { id: 'refunds', title: 'Refunds', icon: RefundsIcon },
  { id: 'profile', title: 'Profile', icon: ProfileIcon },
  { id: 'payment-management', title: 'Payment management', icon: PaymentManagementIcon },
  { id: 'wallet', title: 'Wallet', icon: PaymentManagementIcon },
  { id: 'general-info', title: 'General Info', icon: GeneralInfoIcon },
  { id: 'notifications', title: 'Notifications', icon: NotificationsIcon },
];

interface SettingsProps {
  onLogout?: () => void;
}

const SettingsScreen: React.FC<SettingsProps> = ({ onLogout }) => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { setUser } = useUser();

  useRefreshAppConfigOnFocus();

  const handleItemPress = (itemId: string) => {
    switch (itemId) {
      case 'orders':
        navigation.navigate('Orders');
        break;
      case 'customer-support':
        navigation.navigate('CustomerSupport');
        break;
      case 'addresses':
        navigation.navigate('Addresses');
        break;
      case 'refunds':
        navigation.navigate('Refunds');
        break;
      case 'profile':
        navigation.navigate('Profile');
        break;
      case 'payment-management':
        navigation.navigate('PaymentManagement');
        break;
      case 'wallet':
        navigation.navigate('Wallet');
        break;
      case 'general-info':
        navigation.navigate('GeneralInfo');
        break;
      case 'notifications':
        navigation.navigate('Notifications');
        break;
      default:
        logger.info('Unknown item', { itemId });
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await tokenManager.clearTokens();
              } catch (error) {
                logger.warn('Failed to fully clear session during logout', error);
              } finally {
                setUser(null);
                if (onLogout) {
                  onLogout();
                }
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Splash', params: { next: 'Login' } }],
                });
              }
            })();
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header title="Settings" />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.itemsContainer}>
          {SETTINGS_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.settingsItem}
              onPress={() => handleItemPress(item.id)}
              activeOpacity={0.7}
            >
              <View style={styles.itemContent}>
                <View style={styles.itemLeft}>
                  <View style={styles.iconContainer}>
                    <item.icon width={20} height={20} />
                  </View>
                  <Text style={styles.itemText}>{item.title}</Text>
                </View>
                <ChevronRightIcon width={20} height={20} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
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
    paddingBottom: 20,
  },
  itemsContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 12,
  },
  settingsItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    // marginBottom removed - gap is handled by itemsContainer gap: 8
  },
  itemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  iconContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: '#4C4C4C',
  },
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#034703',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    // Inset shadow effect - React Native doesn't support inset shadows natively
    // Using a subtle shadow to approximate the inset effect
    shadowColor: '#011501',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.31,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24, // 1.5em = 24px
    color: '#034703',
    textAlign: 'center',
  },
});

export default SettingsScreen;

