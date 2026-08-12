import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useRefreshAppConfigOnFocus } from '../hooks/useRefreshAppConfigOnFocus';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '../types/navigation';
import Header from '../components/layout/Header';
import NotificationItem from '../components/features/notification/NotificationItem';
import { logger } from '@/utils/logger';
import { useAppConfig } from '../contexts/AppConfigContext';
import { useResponsive } from '@/utils/responsive';
import {
  fetchPreferences,
  updatePreferences,
  type CategoryChannelKey,
  type CategoryPreferences,
  type NotificationPreferences,
} from '../services/notifications/inboxApi';

interface NotificationSetting {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
}

const FALLBACK_NOTIFICATION_SETTINGS: NotificationSetting[] = [
  { id: 'push', title: 'Push Notifications', description: 'Turn on to get live order updates & offers', enabled: true },
  { id: 'inApp', title: 'In-App Notifications', description: 'Show alerts in the notification inbox', enabled: true },
  { id: 'sms', title: 'SMS Notifications', description: 'Receive order & delivery updates via SMS', enabled: true },
  { id: 'whatsapp', title: 'WhatsApp Messages', description: 'Get updates from us on WhatsApp', enabled: true },
  { id: 'email', title: 'Email Notifications', description: 'Receive invoices & offers via email', enabled: true },
];

const CATEGORY_KEYS = [
  { id: 'order', label: 'Order Updates' },
  { id: 'offers', label: 'Offers & Discounts' },
  { id: 'promotional', label: 'Promotional' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'system', label: 'System' },
] as const;

const CATEGORY_CHANNELS: { key: CategoryChannelKey; label: string }[] = [
  { key: 'push', label: 'Push' },
  { key: 'inApp', label: 'In-App' },
  { key: 'sms', label: 'SMS' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'Email' },
];

const DEFAULT_CAT_CHANNELS = {
  push: true,
  inApp: true,
  sms: true,
  whatsapp: true,
  email: true,
};

function defaultCategories(): CategoryPreferences {
  return {
    order: { ...DEFAULT_CAT_CHANNELS },
    offers: { ...DEFAULT_CAT_CHANNELS },
    promotional: { ...DEFAULT_CAT_CHANNELS },
    wallet: { ...DEFAULT_CAT_CHANNELS },
    system: { ...DEFAULT_CAT_CHANNELS },
    welcome: { ...DEFAULT_CAT_CHANNELS },
  };
}

const DND_HOURS = Array.from({ length: 24 }, (_, i) => {
  const hour = i % 12 || 12;
  const suffix = i < 12 ? 'AM' : 'PM';
  return { value: i, label: `${hour}:00 ${suffix}` };
});

const Notifications: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { isTablet, scaleFont: rFont } = useResponsive();
  const { appConfig } = useAppConfig();
  const channelsFromConfig = appConfig.notifications?.channelsAvailable ?? [];
  const channelsSignature = useMemo(
    () => JSON.stringify(channelsFromConfig.map((c) => [c.key, c.label, c.description, c.isActive])),
    [channelsFromConfig]
  );
  const notificationSettings = channelsFromConfig.length > 0
    ? channelsFromConfig
        .filter((c) => c.key !== 'dnd')
        .map((c) => ({
          id: c.key ?? '',
          title: c.label ?? '',
          description: c.description ?? '',
          enabled: c.isActive !== false,
        }))
    : FALLBACK_NOTIFICATION_SETTINGS;
  const [localSettings, setLocalSettings] = useState<NotificationSetting[]>(notificationSettings);
  const [categories, setCategories] = useState<CategoryPreferences>(defaultCategories);
  const [loading, setLoading] = useState(true);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const dndStartDefault = appConfig.notifications?.dndStartHour ?? 22;
  const dndEndDefault = appConfig.notifications?.dndEndHour ?? 7;
  const [dndEnabled, setDndEnabled] = useState(false);
  const [dndStart, setDndStart] = useState(dndStartDefault);
  const [dndEnd, setDndEnd] = useState(dndEndDefault);
  const [savingDndHours, setSavingDndHours] = useState(false);

  useRefreshAppConfigOnFocus('Notifications');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prefs = await fetchPreferences();
        if (cancelled) return;
        setDndEnabled(prefs.dnd);
        if (prefs.dndStartHour != null) setDndStart(prefs.dndStartHour);
        if (prefs.dndEndHour != null) setDndEnd(prefs.dndEndHour);
        if (prefs.categories) {
          setCategories({ ...defaultCategories(), ...prefs.categories });
        }
        setLocalSettings((prev) =>
          prev.map((s) => {
            if (s.id === 'push') return { ...s, enabled: prefs.push };
            if (s.id === 'inApp') return { ...s, enabled: prefs.inApp };
            if (s.id === 'sms') return { ...s, enabled: prefs.sms };
            if (s.id === 'whatsapp' || s.id === 'wa') return { ...s, enabled: prefs.whatsapp };
            if (s.id === 'email') return { ...s, enabled: prefs.email };
            return s;
          })
        );
      } catch (err) {
        logger.warn('[notifications] failed to load preferences', err);
        if (!cancelled) setLocalSettings(notificationSettings);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [channelsSignature]);

  const handleToggleChange = async (id: string, enabled: boolean) => {
    setLocalSettings((prev) =>
      prev.map((setting) =>
        setting.id === id ? { ...setting, enabled } : setting
      )
    );

    const keyMap: Record<string, keyof NotificationPreferences> = {
      push: 'push',
      inApp: 'inApp',
      sms: 'sms',
      whatsapp: 'whatsapp',
      wa: 'whatsapp',
      email: 'email',
    };
    const apiKey = keyMap[id];
    if (!apiKey) return;

    try {
      await updatePreferences({ [apiKey]: enabled });
    } catch (err) {
      logger.warn('[notifications] failed to save preference', err);
      setLocalSettings((prev) =>
        prev.map((setting) =>
          setting.id === id ? { ...setting, enabled: !enabled } : setting
        )
      );
    }
  };

  const persistDnd = useCallback(
    async (patch: Partial<NotificationPreferences>) => {
      try {
        const saved = await updatePreferences(patch);
        setDndEnabled(saved.dnd);
        if (saved.dndStartHour != null) setDndStart(saved.dndStartHour);
        if (saved.dndEndHour != null) setDndEnd(saved.dndEndHour);
      } catch (err) {
        logger.warn('[notifications] failed to save DND', err);
        throw err;
      }
    },
    []
  );

  const handleDndToggle = async () => {
    const next = !dndEnabled;
    setDndEnabled(next);
    try {
      await persistDnd({
        dnd: next,
        dndStartHour: dndStart,
        dndEndHour: dndEnd,
      });
    } catch {
      setDndEnabled(!next);
    }
  };

  const handleDndHourChange = async (which: 'start' | 'end', hour: number) => {
    const nextStart = which === 'start' ? hour : dndStart;
    const nextEnd = which === 'end' ? hour : dndEnd;
    if (which === 'start') setDndStart(hour);
    else setDndEnd(hour);
    if (!dndEnabled) return;
    setSavingDndHours(true);
    try {
      await persistDnd({
        dnd: true,
        dndStartHour: nextStart,
        dndEndHour: nextEnd,
      });
    } catch {
      /* keep optimistic UI */
    } finally {
      setSavingDndHours(false);
    }
  };

  const onCategoryToggle = async (category: string, channel: CategoryChannelKey) => {
    const key = `${category}.${channel}`;
    if (savingCategory) return;
    setSavingCategory(key);
    const prev = categories;
    const next: CategoryPreferences = {
      ...categories,
      [category]: {
        ...DEFAULT_CAT_CHANNELS,
        ...categories[category],
        [channel]: !(categories[category]?.[channel] !== false),
      },
    };
    setCategories(next);
    try {
      const saved = await updatePreferences({ categories: next });
      if (saved.categories) {
        setCategories({ ...defaultCategories(), ...saved.categories });
      }
    } catch (err) {
      logger.warn('[notifications] failed to save category preference', err);
      setCategories(prev);
    } finally {
      setSavingCategory(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header
        title="Notifications"
        titleStyle={{ fontSize: rFont(18, 16, 22), color: '#4C4C4C' }}
        rightComponent={
          <TouchableOpacity onPress={() => navigation.navigate('NotificationInbox' as never)}>
            <Text style={{ color: '#1a7a2c', fontWeight: '600', fontSize: 13, marginRight: 8 }}>
              Inbox
            </Text>
          </TouchableOpacity>
        }
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.itemsContainer, isTablet && styles.contentTablet]}>
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
        <View style={[styles.dndSection, isTablet && styles.contentTablet]}>
          <View style={styles.dndHeader}>
            <View style={styles.dndHeaderText}>
              <Text style={styles.dndTitle}>Do Not Disturb</Text>
              <Text style={styles.dndDescription}>Pause notifications during set hours</Text>
            </View>
            <TouchableOpacity
              style={[styles.dndToggle, dndEnabled && styles.dndToggleActive]}
              onPress={() => void handleDndToggle()}
              activeOpacity={0.7}
            >
              <View style={[styles.dndToggleThumb, dndEnabled && styles.dndToggleThumbActive]} />
            </TouchableOpacity>
          </View>

          {dndEnabled && (
            <View style={styles.dndTimeContainer}>
              {savingDndHours ? (
                <ActivityIndicator size="small" color="#034703" style={{ marginBottom: 8 }} />
              ) : null}
              <View style={styles.dndTimeRow}>
                <Text style={styles.dndTimeLabel}>From</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dndTimePicker}>
                  {DND_HOURS.map((h) => (
                    <TouchableOpacity
                      key={`start-${h.value}`}
                      style={[styles.dndTimeChip, dndStart === h.value && styles.dndTimeChipSelected]}
                      onPress={() => void handleDndHourChange('start', h.value)}
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
                      onPress={() => void handleDndHourChange('end', h.value)}
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

        {/* Per-category matrix */}
        <View style={[styles.categorySection, isTablet && styles.contentTablet]}>
          <Text style={styles.categoryHeading}>By category</Text>
          <Text style={styles.categorySub}>
            Control which channels deliver each type of notification. Global toggles above still apply.
          </Text>
          {CATEGORY_KEYS.map((cat) => (
            <View key={cat.id} style={styles.categoryCard}>
              <Text style={styles.categoryTitle}>{cat.label}</Text>
              <View style={styles.categoryChannels}>
                {CATEGORY_CHANNELS.map((ch) => {
                  const enabled = categories[cat.id]?.[ch.key] !== false;
                  const busy = savingCategory === `${cat.id}.${ch.key}`;
                  return (
                    <TouchableOpacity
                      key={ch.key}
                      style={[styles.channelChip, enabled && styles.channelChipOn]}
                      onPress={() => void onCategoryToggle(cat.id, ch.key)}
                      disabled={busy}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.channelChipText, enabled && styles.channelChipTextOn]}>
                        {ch.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
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
    paddingBottom: 32,
  },
  itemsContainer: {
    width: '100%',
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 8,
  },
  contentTablet: {
    maxWidth: 560,
    alignSelf: 'center',
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
  categorySection: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  categoryHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  categorySub: {
    fontSize: 13,
    color: '#828282',
    marginBottom: 12,
    lineHeight: 18,
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 10,
  },
  categoryChannels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  channelChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F5F5F5',
  },
  channelChipOn: {
    borderColor: '#034703',
    backgroundColor: '#eaf5e8',
  },
  channelChipText: {
    fontSize: 12,
    color: '#4C4C4C',
    fontWeight: '500',
  },
  channelChipTextOn: {
    color: '#034703',
    fontWeight: '600',
  },
});

export default Notifications;
