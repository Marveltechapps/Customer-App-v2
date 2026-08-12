/**
 * Wallet Service — balance, ledger, and Worldline top-up session.
 */

import { Platform } from 'react-native';
import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { ApiResponse } from '../api/types';

export interface WalletTopUpSession {
  paymentId: string;
  orderId: string;
  txnId: string;
  attemptNo: number;
  amount: number;
  hashAlgo?: string;
  sessionPayload: Record<string, unknown>;
}

export async function fetchWalletBalance(): Promise<ApiResponse<{ balance: number }>> {
  return api.get<{ balance: number }>(endpoints.wallet.balance);
}

export async function fetchWalletTransactions(params?: {
  page?: number;
  limit?: number;
}): Promise<ApiResponse<{ transactions: unknown[] }>> {
  return api.get<{ transactions: unknown[] }>(endpoints.wallet.transactions, { params });
}

/** Start Paynimo session to add money; credit happens only after backend verifies payment. */
export async function initiateWalletTopUp(body: {
  amount: number;
  consumerEmailId?: string;
  consumerMobileNo?: string;
  paymentMode?: string;
}): Promise<WalletTopUpSession> {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const res = await api.post<WalletTopUpSession>(endpoints.wallet.topUpSession, {
    amount: body.amount,
    platform,
    paymentMode: body.paymentMode ?? 'all',
    consumerEmailId: body.consumerEmailId ?? '',
    consumerMobileNo: body.consumerMobileNo ?? '',
  });
  if (!res.success || !res.data) {
    const msg =
      (res as { error?: string; message?: string }).error ||
      (res as { message?: string }).message ||
      'Unable to start wallet top-up';
    throw new Error(typeof msg === 'string' ? msg : 'Unable to start wallet top-up');
  }
  return res.data;
}
