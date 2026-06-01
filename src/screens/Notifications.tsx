import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '../types/navigation';
import Header from '../components/layout/Header';
import NotificationItem from '../components/features/notification/NotificationItem';
import { logger } from '@/utils/logger';
import { useAppConfig } from '../contexts/AppConfigContext';

interface NotificationSetting {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
}

const FALLBACK_NOTIFICATION_SETTINGS: NotificationSetting[] = [
  { id: 'push', title: 'Push Notifications', description: 'Turn on to get live order updates & offers', enabled: true },
  { id: 'sms', title: 'SMS Notifications', description: 'Receive order & delivery updates via SMS', enabled: true },
  { id: 'whatsapp', title: 'WhatsApp Messages', description: 'Get updates from us on WhatsApp', enabled: false },
  { id: 'email', title: 'Email Notifications', description: 'Receive invoices & offers via email', enabled: false },
];

const DND_HOURS = Array.from({ length: 24 }, (_, i) => {
  const hour = i % 12 || 12;
  const suffix = i < 12 ? 'AM' : 'PM';
  return { value: i, label: `${hour}:00 ${suffix}` };
});

const Notifications: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { appConfig } = useAppConfig();
  const channelsFromConfig = appConfig.notifications?.channelsAvailable ?? [];
  const notificationSettings = channelsFromConfig.length > 0
    ? channelsFromConfig.map((c) => ({
        id: c.key ?? '',
        title: c.label ?? '',
        description: c.description ?? '',
        enabled: c.isActive !== false,
      }))
    : FALLBACK_NOTIFICATION_SETTINGS;
  const [localSettings, setLocalSettings] = useState<NotificationSetting[]>(notificationSettings);
  const [loading, setLoading] = useState(false);
  const dndStartDefault = appConfig.notifications?.dndStartHour ?? 22;
  const dndEndDefault = appConfig.notifications?.dndEndHour ?? 7;
  const [dndEnabled, setDndEnabled] = useState(false);
  const [dndStart, setDndStart] = useState(dndStartDefault);
  const [dndEnd, setDndEnd] = useState(dndEndDefault);

  useEffect(() => {
    setLocalSettings(notificationSettings);
  }, [appConfig?.notifications?.channelsAvailable?.length]); // Sync when appConfig loads


  const handleToggleChange = async (id: string, enabled: boolean) => {
    setLocalSettings((prev) =>
      prev.map((setting) =>
        setting.id === id ? { ...setting, enabled } : setting
      )
    );

    // TODO: Replace with actual API call when backend supports notification preferences
    // await fetch(`/api/notification-settings/${id}`, {
    //   method: 'PUT',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ enabled }),
    // });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header 
        title="Notifications" 
        titleStyle={{ fontSize: 18, color: '#4C4C4C' }}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.itemsContainer}>
          {loading ? (
            <Text style={styles.loadingText}>Loading...</Text>
          ) : localSettings.length > 0 ? (
            localSettings.map((setting) => (
              <View key={setting.id} style={styles.itemWrapper}>
                <NotificationItem
                  title={setting.title}
                  description={setting.description}
                  enabled={setting.enabled}
                  onToggle={(enabled) => handleToggleChange(setting.id, enabled)}
                />
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No notification settings available</Text>
          )}
        </View>

        {/* DND Section */}
        <View style={styles.dndSection}>
          <View style={styles.dndHeader}>
            <View style={styles.dndHeaderText}>
              <Text style={styles.dndTitle}>Do Not Disturb</Text>
              <Text style={styles.dndDescription}>Pause notifications during set hours</Text>
            </View>
            <TouchableOpacity
              style={[styles.dndToggle, dndEnabled && styles.dndToggleActive]}
              onPress={() => setDndEnabled(!dndEnabled)}
              activeOpacity={0.7}
            >
              <View style={[styles.dndToggleThumb, dndEnabled && styles.dndToggleThumbActive]} />
            </TouchableOpacity>
          </View>

          {dndEnabled && (
            <View style={styles.dndTimeContainer}>
              <View style={styles.dndTimeRow}>
                <Text style={styles.dndTimeLabel}>From</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dndTimePicker}>
                  {DND_HOURS.map((h) => (
                    <TouchableOpacity
                      key={`start-${h.value}`}
                      style={[styles.dndTimeChip, dndStart === h.value && styles.dndTimeChipSelected]}
                      onPress={() => setDndStart(h.value)}
                    >
                      <Text style={[styles.dndTimeChipText, dndStart === h.value && styles.dndTimeChipTextSelected]}>
                        {h.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.dndTimeRow}>
                <Text style={styles.dndTimeLabel}>To</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dndTimePicker}>
                  {DND_HOURS.map((h) => (
                    <TouchableOpacity
                      key={`end-${h.value}`}
                      style={[styles.dndTimeChip, dndEnd === h.value && styles.dndTimeChipSelected]}
                      onPress={() => setDndEnd(h.value)}
                    >
                      <Text style={[styles.dndTimeChipText, dndEnd === h.value && styles.dndTimeChipTextSelected]}>
                        {h.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
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
  itemsContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 8,
  },
  itemWrapper: {
    width: '100%',
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
  dndSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  dndHeader: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dndHeaderText: {
    flex: 1,
    marginRight: 12,
  },
  dndTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  dndDescription: {
    fontSize: 12,
    fontWeight: '400',
    color: '#828282',
    marginTop: 2,
  },
  dndToggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D4D4D4',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  dndToggleActive: {
    backgroundColor: '#034703',
  },
  dndToggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
  dndToggleThumbActive: {
    alignSelf: 'flex-end',
  },
  dndTimeContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
    gap: 12,
  },
  dndTimeRow: {
    gap: 8,
  },
  dndTimeLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4C4C4C',
  },
  dndTimePicker: {
    flexDirection: 'row',
  },
  dndTimeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dndTimeChipSelected: {
    backgroundColor: '#034703',
    borderColor: '#034703',
  },
  dndTimeChipText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#4C4C4C',
  },
  dndTimeChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
});

export default Notifications;

