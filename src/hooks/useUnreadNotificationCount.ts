/**
 * Unread notification count — shared badge source for Settings / Home profile.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchUnreadCount } from '../services/notifications/inboxApi';
import { useUser } from '../contexts/UserContext';
import { logger } from '@/utils/logger';

const POLL_MS = 30_000;

export function useUnreadNotificationCount(options?: { poll?: boolean }) {
  const poll = options?.poll !== false;
  const { isAuthenticated } = useUser();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setCount(0);
      return 0;
    }
    setLoading(true);
    try {
      const n = await fetchUnreadCount();
      if (mountedRef.current) setCount(Math.max(0, n));
      return n;
    } catch (err) {
      logger.warn('Failed to fetch unread notification count', err);
      return 0;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  useEffect(() => {
    if (!poll || !isAuthenticated) return;

    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') void refresh();
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [poll, isAuthenticated, refresh]);

  useEffect(() => {
    if (!isAuthenticated) setCount(0);
  }, [isAuthenticated]);

  return { count, loading, refresh, setCount };
}

/** Display helper: 9+ cap like web header. */
export function formatUnreadBadge(count: number): string | null {
  if (count <= 0) return null;
  if (count > 9) return '9+';
  return String(count);
}
