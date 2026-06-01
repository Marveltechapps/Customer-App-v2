/**
 * Support Service
 * Creates support tickets via POST /api/v1/support/tickets (public endpoint)
 */
import { getEnvConfigSafe } from '../../config/env';

function getSupportBaseUrl(): string {
  const { apiBaseUrl } = getEnvConfigSafe();
  // Strip /customer suffix to get root API base, then use /support
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
  orderNumber?: string;
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
  const baseUrl = getSupportBaseUrl();
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
    return { success: true, data: data.data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Network error',
    };
  }
}
