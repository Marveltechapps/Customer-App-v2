import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '../types/navigation';
import Header from '../components/layout/Header';
import ChevronRightIcon from '../assets/images/chevron-right.svg';
import { logger } from '@/utils/logger';
import {
  SETTINGS_MENU_ITEMS,
  type SettingsMenuItemConfig,
  type SettingsMenuItemId,
} from './settings/settingsMenuConfig';
import SettingsLogoutSection from './settings/SettingsLogoutSection';

interface SettingsProps {
  onLogout?: () => void;
}

interface SettingsMenuRowProps {
  item: SettingsMenuItemConfig;
  showIcon: boolean;
  onPress: (id: SettingsMenuItemId) => void;
}

const SettingsMenuRow = React.memo(function SettingsMenuRow({
  item,
  showIcon,
  onPress,
}: SettingsMenuRowProps) {
  const Icon = item.icon;
  return (
    <TouchableOpacity
      style={styles.settingsItem}
      onPress={() => onPress(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.itemContent}>
        <View style={styles.itemLeft}>
          <View style={styles.iconContainer}>
            {showIcon ? <Icon width={20} height={20} /> : null}
          </View>
          <Text style={styles.itemText}>{item.title}</Text>
        </View>
        <ChevronRightIcon width={20} height={20} />
      </View>
    </TouchableOpacity>
  );
});

const SettingsScreen: React.FC<SettingsProps> = ({ onLogout }) => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const mountAtRef = useRef(Date.now());
  const [showIcons, setShowIcons] = React.useState(false);

  useEffect(() => {
    logger.info('[settings-perf] mount', { screen: 'Settings' });
    const task = InteractionManager.runAfterInteractions(() => {
      setShowIcons(true);
      logger.info('[settings-perf] icons ready', {
        elapsedMs: Date.now() - mountAtRef.current,
      });
    });
    return () => task.cancel();
  }, []);

  const handleItemPress = useCallback(
    (itemId: SettingsMenuItemId) => {
      const t0 = Date.now();
      logger.info('[settings-perf] navigation start', { itemId });
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
      logger.info('[settings-perf] navigation dispatched', {
        itemId,
        elapsedMs: Date.now() - t0,
      });
    },
    [navigation],
  );

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
          {SETTINGS_MENU_ITEMS.map((item) => (
            <SettingsMenuRow
              key={item.id}
              item={item}
              showIcon={showIcons}
              onPress={handleItemPress}
            />
          ))}
        </View>

        <SettingsLogoutSection onLogout={onLogout} />
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
});

export default React.memo(SettingsScreen);
