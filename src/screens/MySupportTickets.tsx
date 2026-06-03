/**
 * My Support Tickets – list tickets submitted by the logged-in customer
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Header from '../components/layout/Header';
import type { CustomerSupportStackNavigationProp } from '../types/navigation';
import {
  listMySupportTickets,
  type SupportTicketSummary,
} from '../services/support/supportService';

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_for_customer: 'Waiting for Customer',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_COLOR: Record<string, string> = {
  open: '#2563EB',
  in_progress: '#7C3AED',
  waiting_for_customer: '#D97706',
  resolved: '#059669',
  closed: '#6B7280',
};

const MySupportTickets: React.FC = () => {
  const navigation = useNavigation<CustomerSupportStackNavigationProp>();
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTickets = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await listMySupportTickets();
      setTickets(data);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTickets();
    }, [loadTickets])
  );

  const renderItem = ({ item }: { item: SupportTicketSummary }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('SupportTicketDetail', { ticketId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.ticketNumber}>{item.ticketNumber}</Text>
        <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLOR[item.status] || '#6B7280'}20` }]}>
          <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] || '#6B7280' }]}>
            {STATUS_LABEL[item.status] || item.status}
          </Text>
        </View>
      </View>
      <Text style={styles.subject} numberOfLines={2}>
        {item.subject}
      </Text>
      <Text style={styles.meta}>
        {item.category} · {new Date(item.updatedAt || item.createdAt).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="My tickets" onBackPress={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#175FBE" size="large" />
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={tickets.length === 0 ? styles.emptyList : styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadTickets(true)} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>No tickets yet</Text>
              <Text style={styles.emptySub}>
                Submit a request from Contact Support and it will appear here.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  list: { padding: 16, paddingBottom: 32 },
  emptyList: { flexGrow: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  ticketNumber: { fontSize: 13, fontWeight: '700', color: '#E11D48', fontFamily: 'monospace' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '600' },
  subject: { fontSize: 15, fontWeight: '600', color: '#1A1A1A', marginBottom: 6 },
  meta: { fontSize: 12, color: '#6B7280' },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
});

export default MySupportTickets;
