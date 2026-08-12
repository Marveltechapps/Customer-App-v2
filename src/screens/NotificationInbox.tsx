import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '../types/navigation';
import Header from '../components/layout/Header';
import { useResponsive } from '@/utils/responsive';
import {
  deleteInboxItem,
  fetchInbox,
  markAllRead,
  markRead,
  markUnread,
  type InboxNotification,
} from '../services/notifications/inboxApi';
import { resolveNotificationNavigation } from '../utils/resolveNotificationNavigation';

const CATEGORY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'order', label: 'Orders' },
  { id: 'offers', label: 'Offers' },
  { id: 'promotional', label: 'Promo' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'system', label: 'System' },
];

function timeAgo(value: string): string {
  const date = new Date(value);
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const PAGE_SIZE = 20;

const NotificationInbox: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { scaleFont: rFont } = useResponsive();
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (opts?: { page?: number; append?: boolean }) => {
      const nextPage = opts?.page ?? 1;
      const append = opts?.append === true;
      try {
        if (!append) setError(null);
        const result = await fetchInbox({
          page: nextPage,
          limit: PAGE_SIZE,
          category: category === 'all' ? undefined : category,
        });
        setItems((prev) =>
          append
            ? [
                ...prev,
                ...result.notifications.filter(
                  (n) => !prev.some((p) => p.id === n.id)
                ),
              ]
            : result.notifications
        );
        setUnreadCount(result.unreadCount);
        setPage(result.page);
        setHasMore(result.hasMore);
      } catch {
        if (!append) {
          setError('Failed to load notifications. Pull down to retry.');
          setItems([]);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [category]
  );

  useEffect(() => {
    setLoading(true);
    setPage(1);
    setHasMore(false);
    void load({ page: 1, append: false });
    const timer = setInterval(() => void load({ page: 1, append: false }), 30000);
    return () => clearInterval(timer);
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load({ page: 1, append: false });
  };

  const onLoadMore = () => {
    if (!hasMore || loadingMore || loading || refreshing) return;
    setLoadingMore(true);
    void load({ page: page + 1, append: true });
  };

  const onOpen = async (item: InboxNotification) => {
    if (!item.read) {
      try {
        await markRead(item.id);
        setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        /* ignore */
      }
    }
    const data = (item.data ?? {}) as Record<string, unknown>;
    const target = resolveNotificationNavigation({
      type:
        typeof data.type === 'string'
          ? data.type
          : typeof item.category === 'string'
            ? item.category
            : undefined,
      orderId: typeof data.orderId === 'string' ? data.orderId : undefined,
      ...data,
    });
    if (!target) return;
    if (target.screen === 'Payment') {
      navigation.navigate('Payment', target.params);
      return;
    }
    navigation.navigate(target.screen as never);
  };

  const onToggleRead = async (item: InboxNotification) => {
    try {
      if (item.read) {
        await markUnread(item.id);
        setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: false } : n)));
        setUnreadCount((c) => c + 1);
      } else {
        await markRead(item.id);
        setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {
      /* ignore */
    }
  };

  const onDelete = async (id: string) => {
    try {
      await deleteInboxItem(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
    } catch {
      /* ignore */
    }
  };

  const onMarkAll = async () => {
    try {
      await markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header
        title="Inbox"
        titleStyle={{ fontSize: rFont(18, 16, 22), color: '#4C4C4C' }}
        rightComponent={
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
            <Text style={styles.settingsLink}>Settings</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.toolbar}>
        <Text style={styles.unreadText}>
          {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
        </Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={() => void onMarkAll()}>
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filters}>
        {CATEGORY_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[styles.chip, category === f.id && styles.chipActive]}
            onPress={() => setCategory(f.id)}
          >
            <Text style={[styles.chipText, category === f.id && styles.chipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#1a7a2c" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1a7a2c" />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.empty}>
                {error || 'No notifications yet'}
              </Text>
              {error ? (
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => {
                    setLoading(true);
                    void load({ page: 1, append: false });
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color="#1a7a2c" />
            ) : hasMore ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={onLoadMore}>
                <Text style={styles.loadMoreText}>Load more</Text>
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={[styles.card, !item.read && styles.cardUnread]}>
              <TouchableOpacity style={styles.cardMain} onPress={() => void onOpen(item)}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardBody} numberOfLines={2}>
                  {item.body}
                </Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.category}>
                    {(item.category || 'update').toUpperCase()}
                  </Text>
                  <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => void onToggleRead(item)}>
                  <Text style={styles.actionText}>{item.read ? 'Unread' : 'Read'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => void onDelete(item.id)}>
                  <Text style={[styles.actionText, { color: '#c0392b' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  settingsLink: { color: '#1a7a2c', fontWeight: '600', fontSize: 13, marginRight: 8 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  unreadText: { color: '#6b7280', fontSize: 13 },
  markAll: { color: '#1a7a2c', fontWeight: '700', fontSize: 13 },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#1a7a2c', borderColor: '#1a7a2c' },
  chipText: { fontSize: 11, fontWeight: '600', color: '#555' },
  chipTextActive: { color: '#fff' },
  list: { padding: 16, paddingBottom: 40 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 8, fontSize: 14 },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  retryBtn: {
    marginTop: 14,
    backgroundColor: '#1a7a2c',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  loadMoreText: {
    color: '#1a7a2c',
    fontWeight: '600',
    fontSize: 14,
  },
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  cardUnread: { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' },
  cardMain: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#222' },
  cardBody: { marginTop: 4, fontSize: 13, color: '#6b7280', lineHeight: 18 },
  cardMeta: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  category: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4b5d4b',
    backgroundColor: '#eef2ea',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  time: { fontSize: 11, color: '#9ca3af' },
  cardActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  actionText: { fontSize: 12, fontWeight: '600', color: '#1a7a2c' },
});

export default NotificationInbox;
