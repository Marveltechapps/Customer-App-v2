import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

export type UseRefreshOnFocusOptions = {
  /** When false, focus events do not call refresh (e.g. while a child overlay is open). */
  enabled?: boolean;
};

/**
 * Runs `refresh` whenever the screen gains focus (including the first time it is shown).
 * Use on API-backed screens so navigating back always loads the latest server data.
 */
export function useRefreshOnFocus(
  refresh: () => void | Promise<void>,
  deps: ReadonlyArray<unknown> = [],
  options?: UseRefreshOnFocusOptions,
): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const enabled = options?.enabled !== false;

  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        return;
      }
      void refreshRef.current();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, ...deps]),
  );
}
