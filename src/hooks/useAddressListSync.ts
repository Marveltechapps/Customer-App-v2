import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { useRefreshOnFocus } from './useRefreshOnFocus';
import type { Address } from '../services/address/addressService';
import { addressService } from '../services/address/addressService';
import { subscribeAddressesChanged } from '../utils/addressRefresh';
import { logger } from '@/utils/logger';

/**
 * Keeps a saved-address list in sync with the server.
 * Always refetches from the API on screen focus and after address mutations — no in-memory merge cache.
 */
export function useAddressListSync(
  setAddresses: Dispatch<SetStateAction<Address[]>>,
  options?: { onLoaded?: (list: Address[]) => void },
) {
  const onLoadedRef = useRef(options?.onLoaded);
  onLoadedRef.current = options?.onLoaded;

  const fetchAddresses = useCallback(
    async (silent = false) => {
      try {
        const res = await addressService.getAll();
        if (res?.success && Array.isArray(res.data)) {
          setAddresses(res.data);
          onLoadedRef.current?.(res.data);
        } else if (!silent) {
          setAddresses([]);
          onLoadedRef.current?.([]);
        }
      } catch (error) {
        logger.error('Error fetching addresses', error);
      }
    },
    [setAddresses],
  );

  useRefreshOnFocus(() => {
    void fetchAddresses();
  }, [fetchAddresses]);

  useEffect(() => {
    return subscribeAddressesChanged(() => {
      void fetchAddresses(true);
    });
  }, [fetchAddresses]);

  return { fetchAddresses };
}
