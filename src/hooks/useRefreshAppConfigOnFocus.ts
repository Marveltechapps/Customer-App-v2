import { useAppConfig } from '../contexts/AppConfigContext';
import { useRefreshOnFocus } from './useRefreshOnFocus';

/** Refetches `/app-config` whenever the screen gains focus (support, notifications, checkout fees, etc.). */
export function useRefreshAppConfigOnFocus(): void {
  const { refreshConfig } = useAppConfig();
  useRefreshOnFocus(() => {
    void refreshConfig();
  }, [refreshConfig]);
}
