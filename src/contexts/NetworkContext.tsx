import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { NavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../types/navigation';
import { logger } from '@/utils/logger';

/** Delay before showing offline screen after NetInfo reports offline (avoids false positives on simulator / brief flaps). */
const OFFLINE_DEBOUNCE_MS = 2500;

interface NetworkContextType {
  isConnected: boolean | null;
  previousRoute: { name: keyof RootStackParamList; params?: any } | null;
  setNavigationRef: (ref: NavigationContainerRef<RootStackParamList> | null) => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [previousRoute, setPreviousRoute] = useState<{ name: keyof RootStackParamList; params?: any } | null>(null);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList> | null>(null);
  const isNavigatingRef = useRef<boolean>(false);
  const offlineDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setNavigationRef = useCallback((ref: NavigationContainerRef<RootStackParamList> | null) => {
    navigationRef.current = ref;
  }, []);

  useEffect(() => {
    // Check if NetInfo native module is available
    if (!NetInfo || typeof NetInfo.fetch !== 'function' || typeof NetInfo.addEventListener !== 'function') {
      logger.warn('NetInfo native module is not available. Network monitoring disabled.');
      // Assume connected in development/expo dev client
      setIsConnected(true);
      return;
    }

    // Get initial network state (don't treat first result as final; some platforms report false then true)
    const fetchInitialNetworkState = async () => {
      try {
        const state = await NetInfo.fetch();
        setIsConnected(state.isConnected ?? false);
      } catch (error) {
        logger.error('Error fetching initial network state', error);
        setIsConnected(true); // Assume connected on error
      }
    };

    fetchInitialNetworkState();

    const tryNavigateToNoInternet = () => {
      if (!navigationRef.current || isNavigatingRef.current) return;
      const currentRoute = navigationRef.current.getCurrentRoute();
      if (currentRoute?.name === 'NoInternet') return;

      setPreviousRoute((prevRoute) => {
        if (!prevRoute) {
          return {
            name: currentRoute?.name as keyof RootStackParamList,
            params: currentRoute?.params,
          };
        }
        return prevRoute;
      });
      isNavigatingRef.current = true;
      (navigationRef.current.navigate as any)('NoInternet');
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 500);
    };

    // Subscribe to network state changes (only if available)
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = NetInfo.addEventListener?.((state: NetInfoState) => {
        const connected = state.isConnected ?? false;

        setIsConnected((prevConnected) => {
          const wasConnected = prevConnected;

          // Only handle navigation if we have a navigation ref
          if (!navigationRef.current) {
            return connected;
          }

          const currentRoute = navigationRef.current.getCurrentRoute();

          // If we just went offline: debounce before showing NoInternet (avoids simulator/brief flaps)
          if (!connected && wasConnected && currentRoute?.name !== 'NoInternet') {
            if (offlineDebounceRef.current) {
              clearTimeout(offlineDebounceRef.current);
              offlineDebounceRef.current = null;
            }
            offlineDebounceRef.current = setTimeout(async () => {
              offlineDebounceRef.current = null;
              try {
                const recheck = await NetInfo.fetch();
                if (recheck.isConnected ?? false) {
                  setIsConnected(true);
                  return;
                }
              } catch {
                // ignore
              }
              tryNavigateToNoInternet();
            }, OFFLINE_DEBOUNCE_MS);
          }

          // If we just came back online
          if (connected && !wasConnected && currentRoute?.name === 'NoInternet') {
            if (offlineDebounceRef.current) {
              clearTimeout(offlineDebounceRef.current);
              offlineDebounceRef.current = null;
            }
            if (!isNavigatingRef.current) {
              isNavigatingRef.current = true;

              setPreviousRoute((storedRoute) => {
                if (storedRoute && navigationRef.current) {
                  (navigationRef.current.navigate as any)(storedRoute.name, storedRoute.params);
                } else if (navigationRef.current) {
                  navigationRef.current.reset({
                    index: 0,
                    routes: [{ name: 'Splash', params: { next: 'Login' } }],
                  });
                }
                return null;
              });

              setTimeout(() => {
                isNavigatingRef.current = false;
              }, 500);
            }
          }

          return connected;
        });
      });
    } catch (error) {
      logger.warn('Failed to subscribe to NetInfo events', error);
    }

    return () => {
      if (offlineDebounceRef.current) {
        clearTimeout(offlineDebounceRef.current);
        offlineDebounceRef.current = null;
      }
      if (typeof unsubscribe === 'function') {
        try {
          unsubscribe();
        } catch (error) {
          logger.warn('Error unsubscribing from NetInfo', error);
        }
      }
    };
  }, []);

  return (
    <NetworkContext.Provider value={{ isConnected, previousRoute, setNavigationRef }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};

