import { api } from '../services/api/client';
import { endpoints } from '../services/api/endpoints';
import { logger } from './logger';

export interface SupportChatMessage {
  id: string;
  text: string;
  sender: 'customer' | 'agent';
  timestamp: string;
}

export const SUPPORT_CHAT_WELCOME: SupportChatMessage = {
  id: 'support-welcome',
  text: 'Hi! How can we help you today? Send a message and our team will respond shortly.',
  sender: 'agent',
  timestamp: new Date(0).toISOString(),
};

/** Legacy tickets stored the ticket subject as a fake customer message. */
export function normalizeChatMessages(
  msgs: SupportChatMessage[],
  context?: { subject?: string },
): SupportChatMessage[] {
  const subject = context?.subject?.trim();
  if (!subject || msgs.length === 0) return msgs;

  const isBootstrapGhost = (m: SupportChatMessage, index: number) =>
    m.sender === 'customer' &&
    m.text.trim() === subject &&
    (msgs.length === 1 || index === 0);

  const filtered = msgs.filter((m, i) => !isBootstrapGhost(m, i));
  return filtered.length === msgs.length ? msgs : filtered;
}

export function ticketIdFromResponse(res: { data?: { id?: string; _id?: string } } | null | undefined): string | null {
  const id = res?.data?.id ?? res?.data?._id;
  return id ? String(id) : null;
}

export async function getOrCreateLiveChatTicket(opts: {
  subject: string;
  type: 'general_inquiry' | 'order_issue';
  orderNumber?: string;
}): Promise<string | null> {
  try {
    const activeRes = await api.get<{ data?: { id?: string; _id?: string } | null }>(
      endpoints.support.activeTicket(opts.orderNumber),
    );
    const existing = ticketIdFromResponse(activeRes);
    if (existing) return existing;
  } catch (err) {
    logger.warn('Could not load active chat ticket, will create one', err);
  }

  try {
    const res = await api.post<{ data?: { id?: string; _id?: string } }>(endpoints.support.createTicket, {
      subject: opts.subject,
      type: opts.type,
      orderNumber: opts.orderNumber,
      channel: 'chat',
    });
    return ticketIdFromResponse(res);
  } catch (err) {
    logger.error('Error creating support ticket', err);
    return null;
  }
}

export async function fetchSupportChatMessages(ticketId: string): Promise<SupportChatMessage[]> {
  const res = await api.get<any>(endpoints.support.ticketMessages(ticketId));
  const msgs = res?.data?.messages ?? res?.messages ?? res?.data ?? [];
  if (!Array.isArray(msgs)) return [];
  return msgs.map((m: any) => ({
    id: String(m.id ?? m._id ?? `${Date.now()}-${Math.random()}`),
    text: String(m.text ?? m.message ?? ''),
    sender: m.sender === 'agent' ? 'agent' : 'customer',
    timestamp: String(m.timestamp ?? m.createdAt ?? new Date().toISOString()),
  }));
}
