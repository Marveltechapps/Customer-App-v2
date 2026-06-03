import { useAppConfig } from '../contexts/AppConfigContext';
import { useRefreshOnFocus } from './useRefreshOnFocus';

/** Refetches `/app-config` whenever the screen gains focus (support, notifications, checkout fees, etc.). */
export function useRefreshAppConfigOnFocus(screenName?: string): void {
  const { refreshConfig } = useAppConfig();
  useRefreshOnFocus(() => {
    void refreshConfig({ minIntervalMs: 60_000, showLoading: false, source: screenName || 'focus' });
  }, [refreshConfig]);
}
