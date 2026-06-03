/**
 * Support Service – create and track support tickets via customer API (auth)
 * with public fallback when not logged in.
 */
import { getEnvConfigSafe } from '../../config/env';
import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import { tokenManager } from '../api/tokenManager';

function getPublicSupportBaseUrl(): string {
  const { apiBaseUrl } = getEnvConfigSafe();
  const base = apiBaseUrl.replace(/\/customer\/?$/, '');
  return `${base}/support`;
}

export interface CreateTicketRequest {
  subject: string;
  description?: string;
  category?: string;
  priority?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerId?: string;
  orderNumber?: string;
}

export interface SupportTicketSummary {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  channel?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  noteCount?: number;
  canReopen?: boolean;
}

export interface SupportTicketMessage {
  id: string;
  text: string;
  sender: 'customer' | 'agent';
  authorName?: string;
  timestamp: string;
}

export interface CreateTicketResponse {
  success: boolean;
  data?: {
    id: string;
    ticketNumber: string;
    subject: string;
    status: string;
  };
  error?: string;
}

export async function createSupportTicket(
  body: CreateTicketRequest
): Promise<CreateTicketResponse> {
  if (tokenManager.isAuthenticated()) {
    try {
      const res = await api.post<{
        id: string;
        ticketNumber: string;
        subject: string;
        status: string;
      }>(endpoints.support.createTicket, {
        ...body,
        message: body.description,
      });
      if (res.success && res.data) {
        return {
          success: true,
          data: {
            id: res.data.id,
            ticketNumber: res.data.ticketNumber,
            subject: res.data.subject,
            status: res.data.status,
          },
        };
      }
      return { success: false, error: res.message || 'Failed to create ticket' };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Failed to create ticket',
      };
    }
  }

  const baseUrl = getPublicSupportBaseUrl();
  const url = `${baseUrl}/tickets`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, source: 'customer' }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || data.message || 'Failed to create ticket' };
    }
    const ticket = data.data;
    return {
      success: true,
      data: ticket
        ? {
            id: ticket.id,
            ticketNumber: ticket.ticketNumber,
            subject: ticket.subject,
            status: ticket.status,
          }
        : undefined,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Network error',
    };
  }
}

export async function listMySupportTickets(): Promise<SupportTicketSummary[]> {
  const res = await api.get<SupportTicketSummary[]>(endpoints.support.tickets);
  if (!res.success || !Array.isArray(res.data)) return [];
  return res.data;
}

export async function fetchSupportTicketMessages(
  ticketId: string
): Promise<SupportTicketMessage[]> {
  const res = await api.get<{ messages: Array<SupportTicketMessage & { message?: string; createdAt?: string }> }>(
    endpoints.support.ticketMessages(ticketId)
  );
  const raw = res.data?.messages ?? (res as { messages?: Array<SupportTicketMessage & { message?: string; createdAt?: string }> }).messages ?? [];
  return raw.map((m) => ({
    id: m.id,
    text: m.text || m.message || '',
    sender: m.sender === 'agent' ? 'agent' : 'customer',
    authorName: m.authorName,
    timestamp: m.timestamp || m.createdAt || new Date().toISOString(),
  }));
}

export async function sendSupportTicketMessage(
  ticketId: string,
  message: string
): Promise<boolean> {
  const res = await api.post(endpoints.support.sendMessage(ticketId), { message });
  return Boolean(res.success);
}

export async function reopenSupportTicket(ticketId: string): Promise<boolean> {
  const res = await api.post(endpoints.support.reopenTicket(ticketId), {});
  return Boolean(res.success);
}
