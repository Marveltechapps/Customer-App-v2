import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { getToken } from '@/utils/storage';
import { postPaymentCallback } from '../services/payments/standalonePaymentApi';
import {
  openWorldlineGateway,
  normalizeWorldlineSessionPayloadForSdk,
  buildWorldlineCompletePayload,
} from '../services/payments/worldlineCheckout';
import { logger } from '@/utils/logger';

export type StandaloneSession = NonNullable<RootStackParamList['Payment']>['standaloneSession'];

type Phase = 'processing' | 'error' | 'login';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getStandaloneMode(): 'gateway' | 'simulate' {
  const raw = String(Constants.expoConfig?.extra?.paymentStandaloneMode || 'gateway').toLowerCase();
  return raw === 'simulate' ? 'simulate' : 'gateway';
}

function errorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as Error).message === 'string') {
    return (err as Error).message;
  }
  return 'Something went wrong';
}

type Props = {
  standalone: StandaloneSession;
  navigation: NativeStackNavigationProp<RootStackParamList, 'Payment'>;
};

const StandalonePaymentFlow: React.FC<Props> = ({ standalone, navigation }) => {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('processing');
  const [message, setMessage] = useState<string>('');
  const [attempt, setAttempt] = useState(0);

  const displayOrderRef = useMemo(
    () => String(standalone.clientOrderRef || standalone.orderId || '').trim(),
    [standalone.clientOrderRef, standalone.orderId]
  );

  useEffect(() => {
    let cancelled = false;
    const s = standalone;
    const nav = navigation;

    const run = async () => {
      setPhase('processing');
      setMessage('');

      try {
        const token = await getToken();
        if (!token) {
          if (!cancelled) {
            setPhase('login');
            setMessage('Please login');
          }
          return;
        }

        const delayMs = 2000 + Math.floor(Math.random() * 1000);
        await sleep(delayMs);
        if (cancelled) return;

        const mode = getStandaloneMode();
        let callbackBody: Record<string, unknown>;

        if (mode === 'simulate') {
          callbackBody = {
            orderId: s.orderId,
            txnId: s.txnId,
            status: 'success',
            amount: s.amount,
            txn_status: '0300',
            txn_amt: Number(s.amount).toFixed(2),
          };
        } else {
          let sdkResponse: Record<string, unknown>;
          try {
            const raw = await openWorldlineGateway(
              normalizeWorldlineSessionPayloadForSdk(s.sessionPayload as object, s.hashAlgo),
              { hashAlgo: s.hashAlgo }
            );
            sdkResponse =
              raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : {};
          } catch (e) {
            const m = errorMessage(e);
            if (cancelled) return;
            if (m.toLowerCase().includes('network') || m.includes('internet') || m.includes('connection')) {
              setPhase('error');
              setMessage('Check your connection');
              return;
            }
            setPhase('error');
            setMessage(m);
            return;
          }
          if (cancelled) return;
          const { response: merged, debug: sdkDebug } = buildWorldlineCompletePayload(sdkResponse);
          logger.info('Standalone SDK callback keys', {
            txnId: s.txnId,
            mergedKeyCount: Object.keys(merged).length,
            mergedKeys: Object.keys(merged),
            attachedClientDebug: !!sdkDebug,
          });
          callbackBody = {
            ...merged,
            orderId: s.orderId,
            txnId: s.txnId,
            clnt_txn_ref: (merged.clnt_txn_ref as string) ?? (sdkResponse.clnt_txn_ref as string) ?? s.txnId,
            ...(sdkDebug ? { debug: sdkDebug } : {}),
          };
        }

        const result = await postPaymentCallback(callbackBody);
        if (cancelled) return;
        if (!result.ok) {
          setPhase('error');
          setMessage(result.message || 'Payment could not be confirmed');
          return;
        }

        const data = result.data as { orderId?: string } | undefined;
        const displayOrderId = String(data?.orderId ?? s.clientOrderRef ?? s.orderId);

        nav.replace('PaymentSuccess', { orderId: displayOrderId });
      } catch (e) {
        if (cancelled) return;
        const code = errorMessage(e);
        logger.error('Standalone payment flow failed', { code, e });
        if (code === 'NO_JWT') {
          setPhase('login');
          setMessage('Please login');
          return;
        }
        if (code === 'NETWORK') {
          setPhase('error');
          setMessage('Check your connection');
          return;
        }
        setPhase('error');
        setMessage(code);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    attempt,
    standalone.orderId,
    standalone.txnId,
    standalone.amount,
    standalone.clientOrderRef,
    standalone.hashAlgo,
    standalone.sessionPayload,
    navigation,
  ]);

  const retry = () => setAttempt((a) => a + 1);

  const goLogin = () => navigation.replace('Splash', { next: 'Login' });

  const goBack = () => navigation.goBack();

  const resultTitle = phase === 'login' ? 'Sign in required' : 'Payment unsuccessful';
  const resultSubtitle =
    message ||
    (phase === 'login' ? 'Please sign in to complete your payment securely.' : 'Something went wrong with this payment.');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {phase === 'processing' ? (
        <View style={styles.inner}>
          <View style={styles.spinnerWrap}>
            <ActivityIndicator size="large" color="#034703" />
          </View>
          <Text style={styles.processTitle}>Processing payment…</Text>
          <Text style={styles.subtitle}>Please wait while we securely complete your payment.</Text>
        </View>
      ) : (
        <>
          <View style={styles.inner}>
            <View
              style={[
                styles.iconCircle,
                phase === 'login' ? styles.iconCircleLogin : styles.iconCircleError,
              ]}
            >
              <Text style={styles.iconGlyph}>{phase === 'login' ? '!' : '✕'}</Text>
            </View>
            <Text style={styles.title}>{resultTitle}</Text>
            <Text style={styles.subtitle}>{resultSubtitle}</Text>
            {displayOrderRef ? (
              <View style={styles.orderBox}>
                <Text style={styles.orderLabel}>Order ID</Text>
                <Text
                  style={phase === 'login' ? styles.orderValueMuted : styles.orderValueError}
                  selectable
                >
                  {displayOrderRef}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={goBack} activeOpacity={0.85}>
              <Text style={styles.secondaryText}>Go back</Text>
            </TouchableOpacity>
            {phase === 'login' ? (
              <TouchableOpacity style={styles.primaryBtn} onPress={goLogin} activeOpacity={0.85}>
                <Text style={styles.primaryText}>Go to Login</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.primaryBtn} onPress={retry} activeOpacity={0.85}>
                <Text style={styles.primaryText}>Retry payment</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  spinnerWrap: {
    marginBottom: 8,
  },
  processTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 4,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconCircleError: {
    backgroundColor: '#B42318',
  },
  iconCircleLogin: {
    backgroundColor: '#B45309',
  },
  iconGlyph: {
    fontSize: 40,
    color: '#FFFFFF',
    fontWeight: '700',
    marginTop: -2,
  },
  orderBox: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  orderLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6B6B',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  orderValueError: {
    fontSize: 16,
    fontWeight: '600',
    color: '#B42318',
  },
  orderValueMuted: {
    fontSize: 16,
    fontWeight: '600',
    color: '#034703',
  },
  actions: {
    paddingHorizontal: 20,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: '#034703',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#034703',
  },
  secondaryText: {
    color: '#034703',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default StandalonePaymentFlow;
