/**
 * Refunds API service for customer app
 */

import { api } from '../api/client';
import { endpoints } from '../api/endpoints';

export interface RefundItem {
  id: string;
  orderId: string;
  orderNumber: string;
  date: string;
  status: 'completed' | 'pending' | 'rejected';
  statusText: string;
  amount?: number;
  currency?: string;
}

export interface RefundDetails {
  id: string;
  orderNumber: string;
  dateTime: string;
  totalItems: string;
  refundAmountRequested: string;
  refundAmountApproved: string;
  status: 'completed' | 'rejected' | 'pending';
  products: Array<{
    id: string;
    name: string;
    weight?: string;
    discountedPrice: string;
    originalPrice?: string;
    imageUrl?: string;
  }>;
}

export interface RefundRequestPayload {
  orderId: string;
  reasonCode: 'item_damaged' | 'expired' | 'late_delivery' | 'wrong_item' | 'customer_cancelled' | 'other';
  reasonText: string;
  amount?: number;
  currency?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  refunds?: RefundItem[];
  message?: string;
}

export async function fetchRefunds(page = 1, pageSize = 20): Promise<{ refunds: RefundItem[]; pagination: { page: number; total: number; totalPages: number } }> {
  const res = await api.get<{
    success: boolean;
    refunds?: RefundItem[];
    pagination?: { page: number; total: number; totalPages: number };
  }>(`${endpoints.refunds.list}?page=${page}&pageSize=${pageSize}`);
  if (!res.success || !res.refunds) {
    return { refunds: [], pagination: { page: 1, total: 0, totalPages: 1 } };
  }
  const refunds = (res.refunds ?? []).map((r) => ({
    ...r,
    orderNumber: r.orderNumber ?? `Order #${r.orderId}`,
    status: (r.status ?? 'pending') as RefundItem['status'],
    statusText: r.statusText ?? 'Refund pending',
  }));
  return {
    refunds,
    pagination: res.pagination ?? { page: 1, total: refunds.length, totalPages: 1 },
  };
}

export async function fetchRefundDetails(refundId: string): Promise<RefundDetails | null> {
  const res = await api.get<{ success: boolean; data?: RefundDetails }>(endpoints.refunds.details(refundId));
  if (!res.success || !res.data) return null;
  return res.data;
}

export async function createRefundRequest(payload: RefundRequestPayload): Promise<RefundItem | null> {
  const res = await api.post<{ success: boolean; data?: RefundItem }>(endpoints.refunds.request, payload);
  if (!res.success || !res.data) return null;
  return res.data;
}
