import type React from 'react';
import OrdersIcon from '../../assets/images/orders-icon.svg';
import CustomerSupportIcon from '../../assets/images/customer-support-icon.svg';
import AddressesIcon from '../../assets/images/addresses-icon.svg';
import RefundsIcon from '../../assets/images/refunds-icon.svg';
import ProfileIcon from '../../assets/images/profile-icon.svg';
import PaymentManagementIcon from '../../assets/images/payment-management-icon.svg';
import GeneralInfoIcon from '../../assets/images/general-info-icon.svg';
import NotificationsIcon from '../../assets/images/notifications-icon.svg';

export type SettingsMenuItemId =
  | 'orders'
  | 'customer-support'
  | 'addresses'
  | 'refunds'
  | 'profile'
  | 'wallet'
  | 'general-info'
  | 'notifications';

export interface SettingsMenuItemConfig {
  id: SettingsMenuItemId;
  title: string;
  icon: React.ComponentType<{ width?: number; height?: number }>;
}

/** Static menu — no API or persisted config required to render Settings. */
export const SETTINGS_MENU_ITEMS: SettingsMenuItemConfig[] = [
  { id: 'orders', title: 'Orders', icon: OrdersIcon },
  { id: 'customer-support', title: 'Customer Support & FAQ', icon: CustomerSupportIcon },
  { id: 'addresses', title: 'Addresses', icon: AddressesIcon },
  { id: 'refunds', title: 'Refunds', icon: RefundsIcon },
  { id: 'profile', title: 'Profile', icon: ProfileIcon },
  { id: 'wallet', title: 'Wallet', icon: PaymentManagementIcon },
  { id: 'general-info', title: 'General Info', icon: GeneralInfoIcon },
  { id: 'notifications', title: 'Notifications', icon: NotificationsIcon },
];
