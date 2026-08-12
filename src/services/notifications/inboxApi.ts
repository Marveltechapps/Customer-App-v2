import { api } from '../api/client';
import { endpoints } from '../api/endpoints';

export interface InboxNotification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  category?: string;
  data?: Record<string, unknown>;
  createdAt: string;
}

export type CategoryChannelKey = 'push' | 'inApp' | 'sms' | 'whatsapp' | 'email';

export type CategoryChannels = Record<CategoryChannelKey, boolean>;

export type CategoryPreferences = Record<string, CategoryChannels>;

export interface NotificationPreferences {
  push: boolean;
  inApp: boolean;
  sms: boolean;
  whatsapp: boolean;
  email: boolean;
  dnd: boolean;
  dndStartHour?: number;
  dndEndHour?: number;
  categories?: CategoryPreferences;
}

function mapItem(raw: any): InboxNotification {
  return {
    id: String(raw.id ?? raw._id ?? ''),
    title: String(raw.title ?? 'Notification'),
    body: String(raw.body ?? ''),
    read: Boolean(raw.read),
    category: raw.category || raw.data?.category,
    data: raw.data || {},
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  };
}

function mapPreferences(prefs: any): NotificationPreferences {
  return {
    push: prefs?.push !== false,
    inApp: prefs?.inApp !== false,
    sms: prefs?.sms !== false,
    whatsapp: prefs?.whatsapp !== false,
    email: prefs?.email !== false,
    dnd: prefs?.dnd === true,
    dndStartHour:
      prefs?.dndStartHour != null && Number.isFinite(Number(prefs.dndStartHour))
        ? Number(prefs.dndStartHour)
        : undefined,
    dndEndHour:
      prefs?.dndEndHour != null && Number.isFinite(Number(prefs.dndEndHour))
        ? Number(prefs.dndEndHour)
        : undefined,
    categories: prefs?.categories,
  };
}

export async function fetchInbox(params?: {
  page?: number;
  limit?: number;
  category?: string;
}): Promise<{
  notifications: InboxNotification[];
  unreadCount: number;
  page: number;
  hasMore: boolean;
}> {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const res = await api.get<any>(endpoints.notifications.list, {
    params: {
      page,
      limit,
      ...(params?.category ? { category: params.category } : {}),
    },
  });
  const data = res?.data ?? res;
  const list = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.notifications)
      ? data.notifications
      : Array.isArray(data)
        ? data
        : [];
  const totalPages = Number(data?.totalPages ?? data?.pagination?.totalPages ?? 0);
  const hasMore =
    typeof data?.hasMore === 'boolean'
      ? data.hasMore
      : totalPages > 0
        ? page < totalPages
        : list.length >= limit;
  return {
    notifications: list.map(mapItem),
    unreadCount: Number(data?.unreadCount ?? list.filter((n: any) => !n.read).length),
    page,
    hasMore,
  };
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await api.get<any>(endpoints.notifications.unreadCount);
  const data = res?.data ?? res;
  return Number(data?.data?.unreadCount ?? data?.unreadCount ?? 0);
}

export async function markRead(id: string): Promise<void> {
  await api.put(endpoints.notifications.markRead(id));
}

export async function markUnread(id: string): Promise<void> {
  await api.put(endpoints.notifications.markUnread(id));
}

export async function markAllRead(): Promise<void> {
  await api.put(endpoints.notifications.markAllRead);
}

export async function deleteInboxItem(id: string): Promise<void> {
  await api.delete(endpoints.notifications.delete(id));
}

export async function fetchPreferences(): Promise<NotificationPreferences> {
  const res = await api.get<any>(endpoints.notifications.preferences);
  const data = res?.data ?? res;
  const prefs = data?.data ?? data;
  return mapPreferences(prefs);
}

export async function updatePreferences(
  patch: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const res = await api.put<any>(endpoints.notifications.preferences, patch);
  const data = res?.data ?? res;
  const prefs = data?.data ?? data;
  return mapPreferences(prefs);
}

export async function removePushToken(token: string): Promise<void> {
  await api.post(endpoints.notifications.removeToken, { token });
}

export async function removeAllPushTokens(): Promise<void> {
  await api.post(endpoints.notifications.removeAllTokens, {});
}
