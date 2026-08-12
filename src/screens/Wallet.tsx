import React, { useState, useCallback, useMemo } from 'react';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/layout/Header';
import { api } from '../services/api/client';
import { endpoints } from '../services/api/endpoints';
import { initiateWalletTopUp } from '../services/wallet/walletService';
import {
  openWorldlineGateway,
  completeWorldlinePayment,
  buildWorldlineCompletePayload,
  pollWorldlineStatus,
  normalizeWorldlineConsumerFields,
} from '../services/payments/worldlineCheckout';
import { useAppConfig } from '../contexts/AppConfigContext';
import { useUser } from '../contexts/UserContext';
import { logger } from '@/utils/logger';
import { useResponsive } from '@/utils/responsive';

type TxnStatus = 'Success' | 'Pending' | 'Failed' | null;

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  date: string;
  runningBalance: number;
  status: TxnStatus;
}

const DEFAULT_TOP_UP_AMOUNTS = [100, 250, 500];
const DEFAULT_MAX_TOP_UP = 10_000;

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

function mapTxnStatus(raw: unknown): TxnStatus {
  const s = String(raw ?? '').toLowerCase();
  if (!s) return null;
  if (s === 'success' || s === 'completed' || s === 'credited') return 'Success';
  if (s === 'pending' || s === 'processing' || s === 'initiated') return 'Pending';
  if (s === 'failed' || s === 'cancelled' || s === 'canceled' || s === 'declined') return 'Failed';
  return null;
}

const Wallet: React.FC = () => {
  const { isTablet, scaleFont: rFont } = useResponsive();
  const { appConfig } = useAppConfig();
  const { user } = useUser();
  const walletEnabled = appConfig?.featureFlags?.enableWallet !== false;

  const topUpAmounts = useMemo(() => {
    const amounts = appConfig?.wallet?.topUpAmounts;
    if (!Array.isArray(amounts)) return DEFAULT_TOP_UP_AMOUNTS;
    const filtered = amounts.filter((n) => Number.isFinite(n) && n > 0);
    return filtered.length > 0 ? filtered : DEFAULT_TOP_UP_AMOUNTS;
  }, [appConfig?.wallet?.topUpAmounts]);

  const maxTopUp =
    Number(appConfig?.wallet?.maxTopUpAmount) > 0
      ? Number(appConfig.wallet!.maxTopUpAmount)
      : DEFAULT_MAX_TOP_UP;

  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number>(topUpAmounts[0] ?? 100);
  const [useCustom, setUseCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [topUpPending, setTopUpPending] = useState(false);
  const [checkoutHint, setCheckoutHint] = useState<string | null>(null);

  const amountToAdd = useMemo(() => {
    if (useCustom) {
      const n = Number(customAmount);
      return Number.isFinite(n) ? n : 0;
    }
    return selectedAmount;
  }, [useCustom, customAmount, selectedAmount]);

  const customValid =
    amountToAdd >= 1 && amountToAdd <= maxTopUp && Number.isFinite(amountToAdd);

  const fetchWalletData = useCallback(async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setLoading(true);
    setError(null);
    try {
      const [balanceRes, txnRes] = await Promise.all([
        api.get<any>(endpoints.wallet.balance),
        api.get<any>(endpoints.wallet.transactions),
      ]);

      const bal = balanceRes?.data?.balance ?? balanceRes?.data ?? 0;
      setBalance(typeof bal === 'number' ? bal : Number(bal) || 0);

      const txns = txnRes?.data?.transactions ?? txnRes?.data ?? [];
      setTransactions(
        Array.isArray(txns)
          ? txns.map((t: any) => ({
              id: t.id ?? t._id ?? String(Math.random()),
              type: t.type === 'debit' ? 'debit' : 'credit',
              amount: t.amount ?? 0,
              description: t.description ?? t.reason ?? '',
              date: t.date ?? t.createdAt ?? new Date().toISOString(),
              runningBalance: t.runningBalance ?? t.balance ?? 0,
              status: mapTxnStatus(t.status ?? t.paymentStatus),
            }))
          : []
      );
    } catch (err) {
      logger.error('Error fetching wallet data', err);
      setError('Failed to load wallet. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useRefreshOnFocus(() => {
    void fetchWalletData();
  }, [fetchWalletData]);

  const onRefresh = () => {
    setRefreshing(true);
    void fetchWalletData({ soft: true });
  };

  const handleTopUp = async () => {
    if (!walletEnabled) {
      Alert.alert('Unavailable', 'Wallet top-up is not available right now.');
      return;
    }
    if (useCustom && !customValid) {
      Alert.alert(
        'Enter a valid amount',
        `Please enter an amount between ₹1 and ₹${maxTopUp.toLocaleString('en-IN')}.`
      );
      return;
    }
    if (topUpPending || amountToAdd < 1) return;

    setTopUpPending(true);
    setCheckoutHint('Starting secure payment…');
    try {
      const email =
        (user as { email?: string } | null)?.email ||
        (user as { customerEmail?: string } | null)?.customerEmail;
      const mobile =
        (user as { phoneNumber?: string } | null)?.phoneNumber ||
        (user as { mobile?: string } | null)?.mobile;
      const { consumerEmailId, consumerMobileNo } = normalizeWorldlineConsumerFields(
        email,
        mobile
      );

      const session = await initiateWalletTopUp({
        amount: amountToAdd,
        consumerEmailId,
        consumerMobileNo,
        paymentMode: 'all',
      });

      if (!session?.orderId || !session?.sessionPayload || !session?.txnId) {
        throw new Error('Wallet payment session could not be started.');
      }

      setCheckoutHint('Opening payment gateway…');
      const sdkResponse = await openWorldlineGateway(session.sessionPayload, {
        hashAlgo: session.hashAlgo,
      });

      setCheckoutHint('Verifying payment…');
      const { response, debug } = buildWorldlineCompletePayload(sdkResponse);
      await completeWorldlinePayment({
        orderId: session.orderId,
        txnId: session.txnId,
        response,
        ...(debug ? { debug } : {}),
      });

      const finalStatus = await pollWorldlineStatus(session.orderId, undefined, 8);
      if (finalStatus.uiState === 'PAID' || finalStatus.orderPaymentStatus === 'paid') {
        Alert.alert(
          'Money added',
          `₹${amountToAdd.toFixed(2)} has been added to your Selorg Wallet.`
        );
      } else if (
        finalStatus.uiState === 'PENDING_VERIFICATION' ||
        finalStatus.orderPaymentStatus === 'pending'
      ) {
        Alert.alert(
          'Payment pending',
          'Your top-up is being verified. Balance will update shortly — pull to refresh.'
        );
      } else {
        Alert.alert(
          'Top-up failed',
          finalStatus.latestPayment?.statusMessage ||
            'Payment was not completed. Please try again.'
        );
      }
      await fetchWalletData({ soft: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      const lower = message.toLowerCase();
      const cancelled =
        lower.includes('cancel') ||
        lower.includes('0392') ||
        lower.includes('abort') ||
        lower.includes('user closed');
      if (cancelled) {
        Alert.alert('Cancelled', 'You cancelled the payment. You can try again anytime.');
      } else {
        logger.error('Wallet top-up failed', err);
        Alert.alert('Could not complete top-up', message);
      }
    } finally {
      setTopUpPending(false);
      setCheckoutHint(null);
    }
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isCredit = item.type === 'credit';
    const statusColor =
      item.status === 'Pending'
        ? '#e8823a'
        : item.status === 'Failed'
          ? '#e0392b'
          : item.status === 'Success'
            ? '#1a7a2c'
            : undefined;
    return (
      <View style={styles.transactionRow}>
        <View style={styles.txnLeft}>
          <View style={[styles.txnIndicator, isCredit ? styles.txnCredit : styles.txnDebit]} />
          <View style={styles.txnInfo}>
            <Text
              style={[styles.txnDescription, { fontSize: rFont(14, 13, 17) }]}
              numberOfLines={1}
            >
              {item.description}
            </Text>
            <Text style={[styles.txnDate, { fontSize: rFont(12, 11, 14) }]}>
              {formatDate(item.date)}
            </Text>
            {item.status ? (
              <Text style={[styles.txnStatus, statusColor ? { color: statusColor } : null]}>
                {item.status}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.txnRight}>
          <Text
            style={[
              styles.txnAmount,
              isCredit ? styles.txnAmountCredit : styles.txnAmountDebit,
              { fontSize: rFont(14, 13, 17) },
            ]}
          >
            {isCredit ? '+' : '-'}₹{Math.abs(item.amount)}
          </Text>
          <Text style={[styles.txnBalance, { fontSize: rFont(11, 10, 13) }]}>
            Bal: ₹{item.runningBalance}
          </Text>
        </View>
      </View>
    );
  };

  const listHeader = (
    <>
      <View style={[styles.balanceCard, isTablet && styles.contentTablet]}>
        <Text style={[styles.balanceLabel, { fontSize: rFont(14, 13, 17) }]}>
          Available Balance
        </Text>
        <Text style={[styles.balanceAmount, { fontSize: rFont(36, 30, 44) }]}>
          ₹{balance.toFixed(2)}
        </Text>
      </View>

      {walletEnabled ? (
        <View style={[styles.topUpCard, isTablet && styles.contentTablet]}>
          <Text style={[styles.topUpTitle, { fontSize: rFont(16, 15, 18) }]}>Add money</Text>
          <View style={styles.amountRow}>
            {topUpAmounts.map((amt) => (
              <TouchableOpacity
                key={amt}
                style={[
                  styles.amountChip,
                  !useCustom && selectedAmount === amt && styles.amountChipActive,
                ]}
                onPress={() => {
                  setUseCustom(false);
                  setSelectedAmount(amt);
                }}
                disabled={topUpPending}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.amountChipText,
                    !useCustom && selectedAmount === amt && styles.amountChipTextActive,
                  ]}
                >
                  ₹{amt}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.amountChip, useCustom && styles.amountChipActive]}
              onPress={() => setUseCustom(true)}
              disabled={topUpPending}
              activeOpacity={0.7}
            >
              <Text style={[styles.amountChipText, useCustom && styles.amountChipTextActive]}>
                Custom
              </Text>
            </TouchableOpacity>
          </View>
          {useCustom ? (
            <TextInput
              style={styles.customInput}
              keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
              placeholder={`Amount (max ₹${maxTopUp.toLocaleString('en-IN')})`}
              placeholderTextColor="#999"
              value={customAmount}
              onChangeText={setCustomAmount}
              editable={!topUpPending}
            />
          ) : null}
          {checkoutHint ? <Text style={styles.hint}>{checkoutHint}</Text> : null}
          <TouchableOpacity
            style={[styles.topUpBtn, topUpPending && styles.topUpBtnDisabled]}
            onPress={() => void handleTopUp()}
            disabled={topUpPending}
            activeOpacity={0.85}
          >
            {topUpPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.topUpBtnText}>
                Add ₹{amountToAdd > 0 ? amountToAdd.toFixed(0) : '—'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={[styles.transactionsHeader, isTablet && styles.contentTablet]}>
        <Text style={[styles.transactionsTitle, { fontSize: rFont(16, 15, 20) }]}>
          Transaction History
        </Text>
      </View>
    </>
  );

  if (loading && transactions.length === 0 && !error) {
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

      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[styles.listContent, isTablet && styles.listContentTablet]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#034703" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{error || 'No transactions yet'}</Text>
            {error ? (
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => void fetchWalletData()}
                activeOpacity={0.7}
              >
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            ) : null}
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
  topUpCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
  },
  topUpTitle: {
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  amountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  amountChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  amountChipActive: {
    borderColor: '#034703',
    backgroundColor: '#eaf5e8',
  },
  amountChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  amountChipTextActive: {
    color: '#034703',
    fontWeight: '700',
  },
  customInput: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
    color: '#1A1A1A',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  topUpBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#034703',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topUpBtnDisabled: { opacity: 0.6 },
  topUpBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
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
    paddingBottom: 28,
  },
  listContentTablet: {
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  contentTablet: {
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
    marginHorizontal: 16,
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
  txnStatus: {
    fontSize: 11,
    fontWeight: '600',
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
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#034703',
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default Wallet;
