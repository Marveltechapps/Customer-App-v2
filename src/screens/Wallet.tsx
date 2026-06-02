import React, { useState, useCallback } from 'react';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/layout/Header';
import { api } from '../services/api/client';
import { endpoints } from '../services/api/endpoints';
import { logger } from '@/utils/logger';

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  date: string;
  runningBalance: number;
}

const formatDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const h = d.getHours() % 12 || 12;
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}, ${h}:${m} ${ampm}`;
  } catch {
    return dateStr;
  }
};

const Wallet: React.FC = () => {
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWalletData = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const [balanceRes, txnRes] = await Promise.all([
          api.get<any>(endpoints.wallet.balance),
          api.get<any>(endpoints.wallet.transactions),
        ]);

        const bal = balanceRes?.data?.balance ?? balanceRes?.data ?? 0;
        setBalance(typeof bal === 'number' ? bal : 0);

        const txns = txnRes?.data?.transactions ?? txnRes?.data ?? [];
        setTransactions(Array.isArray(txns) ? txns.map((t: any) => ({
          id: t.id ?? t._id ?? String(Math.random()),
          type: t.type === 'debit' ? 'debit' : 'credit',
          amount: t.amount ?? 0,
          description: t.description ?? t.reason ?? '',
          date: t.date ?? t.createdAt ?? new Date().toISOString(),
          runningBalance: t.runningBalance ?? t.balance ?? 0,
        })) : []);
      } catch (err) {
        logger.error('Error fetching wallet data', err);
        setError('Failed to load wallet. Please try again.');
      } finally {
        setLoading(false);
      }
  }, []);

  useRefreshOnFocus(() => {
    void fetchWalletData();
  }, [fetchWalletData]);

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isCredit = item.type === 'credit';
    return (
      <View style={styles.transactionRow}>
        <View style={styles.txnLeft}>
          <View style={[styles.txnIndicator, isCredit ? styles.txnCredit : styles.txnDebit]} />
          <View style={styles.txnInfo}>
            <Text style={styles.txnDescription} numberOfLines={1}>{item.description}</Text>
            <Text style={styles.txnDate}>{formatDate(item.date)}</Text>
          </View>
        </View>
        <View style={styles.txnRight}>
          <Text style={[styles.txnAmount, isCredit ? styles.txnAmountCredit : styles.txnAmountDebit]}>
            {isCredit ? '+' : '-'}₹{Math.abs(item.amount)}
          </Text>
          <Text style={styles.txnBalance}>Bal: ₹{item.runningBalance}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Header title="Wallet" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#034703" />
          <Text style={styles.loadingText}>Loading wallet...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header title="Wallet" />

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>₹{balance.toFixed(2)}</Text>
      </View>

      <View style={styles.transactionsHeader}>
        <Text style={styles.transactionsTitle}>Transaction History</Text>
      </View>

      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {error || 'No transactions yet'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#828282' },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#828282',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#034703',
  },
  transactionsHeader: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
  },
  transactionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
  },
  txnLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  txnIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  txnCredit: { backgroundColor: '#034703' },
  txnDebit: { backgroundColor: '#ED0004' },
  txnInfo: { flex: 1 },
  txnDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  txnDate: {
    fontSize: 12,
    fontWeight: '400',
    color: '#828282',
    marginTop: 2,
  },
  txnRight: { alignItems: 'flex-end', marginLeft: 12 },
  txnAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  txnAmountCredit: { color: '#034703' },
  txnAmountDebit: { color: '#ED0004' },
  txnBalance: {
    fontSize: 11,
    fontWeight: '400',
    color: '#828282',
    marginTop: 2,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#828282',
    textAlign: 'center',
  },
});

export default Wallet;
