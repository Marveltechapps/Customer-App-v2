/**
 * AppConfigContext - Provides app-wide config from backend (fees, tips, support, payment, etc.)
 * Fetched from /app-config or from bootstrap.data.appConfig
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api/client';
import { endpoints } from '../services/api/endpoints';
import { logger } from '../utils/logger';
import { setPlaceholderUrls } from '../config/placeholder';

export interface CheckoutConfig {
  handlingCharge: number;
  deliveryFee: number;
  freeDeliveryMinAmount: number;
  minOrderAmount: number;
  tipAmounts: number[];
  deliveryInstructions?: string[];
  emptyCartTitle?: string;
  emptyCartDescription?: string;
  emptyCartCta?: string;
  paymentInfoText?: string;
}

export interface PaymentMethodConfig {
  key: string;
  label: string;
  description: string;
  icon?: string;
  isActive: boolean;
  order: number;
}

export interface SupportCategoryConfig {
  key: string;
  label: string;
  description: string;
  icon?: string;
  isActive: boolean;
  order: number;
}

export interface AppConfigData {
  checkout?: CheckoutConfig;
  paymentMethods?: PaymentMethodConfig[];
  support?: { contactPhone?: string; contactEmail?: string };
  payment?: {
    upiMerchantId?: string;
    upiMerchantName?: string;
  };
  images?: { placeholderUrl?: string };
  supportCategories?: SupportCategoryConfig[];
  search?: { placeholder?: string; popularSearches?: string[] };
  notifications?: {
    channelsAvailable?: { key: string; label: string; description?: string; isActive?: boolean }[];
    dndStartHour?: number;
    dndEndHour?: number;
  };
  branding?: {
    primaryColor?: string;
    countryCode?: string;
  };
}

const DEFAULT_APP_CONFIG: AppConfigData = {
  checkout: {
    handlingCharge: 5,
    deliveryFee: 0,
    freeDeliveryMinAmount: 0,
    minOrderAmount: 0,
    tipAmounts: [10, 20, 30],
    deliveryInstructions: ['No Contact Delivery', "Don't ring the bell", 'Pet at home'],
  },
  paymentMethods: [
    { key: 'cash', label: 'Cash on Delivery', description: 'Pay when your order arrives', isActive: true, order: 0 },
    {
      key: 'digital',
      label: 'Digital Payment',
      description: 'Card, UPI, net banking, and wallets via Worldline',
      isActive: true,
      order: 1,
    },
  ],
  support: { contactPhone: '+919999999999', contactEmail: 'support@selorg.com' },
  payment: { upiMerchantId: 'merchant@upi', upiMerchantName: 'SelOrg' },
  images: { placeholderUrl: 'https://placehold.co/200x200?text=No+Image' },
  supportCategories: [],
  search: { placeholder: 'Search for products' },
  notifications: { channelsAvailable: [], dndStartHour: 22, dndEndHour: 7 },
  branding: { primaryColor: '#034703', countryCode: '+91' },
};

interface AppConfigContextValue {
  appConfig: AppConfigData;
  isLoading: boolean;
  error: string | null;
  setAppConfig: (config: AppConfigData | null) => void;
  refreshConfig: (options?: { force?: boolean; minIntervalMs?: number; showLoading?: boolean; source?: string }) => Promise<void>;
}

const AppConfigContext = createContext<AppConfigContextValue | undefined>(undefined);

export const AppConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appConfig, setAppConfigState] = useState<AppConfigData>(DEFAULT_APP_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchAtRef = React.useRef<number>(0);
  const inFlightFetchRef = React.useRef<Promise<void> | null>(null);

  const fetchAppConfig = useCallback(async (options?: { force?: boolean; minIntervalMs?: number; showLoading?: boolean; source?: string }) => {
    const minIntervalMs = options?.minIntervalMs ?? 60_000;
    const now = Date.now();
    if (!options?.force && lastFetchAtRef.current > 0 && now - lastFetchAtRef.current < minIntervalMs) {
      logger.info('[app-config-perf] skip fetch (fresh cache)', {
        source: options?.source || 'unknown',
        elapsedMs: now - lastFetchAtRef.current,
      });
      return;
    }

    if (inFlightFetchRef.current) {
      logger.info('[app-config-perf] join in-flight fetch', {
        source: options?.source || 'unknown',
      });
      return inFlightFetchRef.current;
    }

    const t0 = Date.now();
    const fetchPromise = (async () => {
      try {
        logger.info('[app-config-perf] fetch start', { source: options?.source || 'unknown' });
        if (options?.showLoading !== false) {
          setIsLoading(true);
        }
        setError(null);
        const res = await api.get<{ success: boolean; data: AppConfigData }>(endpoints.appConfig);
        if (res?.success && res?.data) {
          const d = res.data;
          const merged = {
            ...DEFAULT_APP_CONFIG,
            ...d,
            checkout: { ...DEFAULT_APP_CONFIG.checkout, ...d?.checkout },
            support: { ...DEFAULT_APP_CONFIG.support, ...d?.support },
            payment: { ...DEFAULT_APP_CONFIG.payment, ...d?.payment },
            images: { ...DEFAULT_APP_CONFIG.images, ...d?.images },
          };
          // Ensure customer app always shows/uses free delivery.
          // (Backend pricing may still calculate fees separately; this is a UI/config override.)
          merged.checkout.deliveryFee = 0;
          setAppConfigState(merged);
          setPlaceholderUrls(merged.images);
          lastFetchAtRef.current = Date.now();
          logger.info('[app-config-perf] fetch success', {
            source: options?.source || 'unknown',
            elapsedMs: Date.now() - t0,
          });
        }
      } catch (err) {
        logger.warn('Failed to fetch app config, using defaults', err);
        setError(err instanceof Error ? err.message : 'Failed to load config');
        setAppConfigState(DEFAULT_APP_CONFIG);
      } finally {
        if (options?.showLoading !== false) {
          setIsLoading(false);
        }
        logger.info('[app-config-perf] fetch end', {
          source: options?.source || 'unknown',
          elapsedMs: Date.now() - t0,
        });
      }
    })();

    inFlightFetchRef.current = fetchPromise;
    try {
      await fetchPromise;
    } finally {
      if (inFlightFetchRef.current === fetchPromise) {
        inFlightFetchRef.current = null;
      }
    }
  }, []);

  const setAppConfig = useCallback((config: AppConfigData | null) => {
    if (config) {
      const merged = {
        ...DEFAULT_APP_CONFIG,
        ...config,
        checkout: { ...DEFAULT_APP_CONFIG.checkout, ...config?.checkout },
        support: { ...DEFAULT_APP_CONFIG.support, ...config?.support },
        payment: { ...DEFAULT_APP_CONFIG.payment, ...config?.payment },
        images: { ...DEFAULT_APP_CONFIG.images, ...config?.images },
      };
      // Ensure customer app always shows/uses free delivery.
      merged.checkout.deliveryFee = 0;
      setAppConfigState(merged);
      setPlaceholderUrls(merged.images);
    }
  }, []);

  useEffect(() => {
    void fetchAppConfig({ force: true, showLoading: true });
  }, [fetchAppConfig]);

  return (
    <AppConfigContext.Provider
      value={{
        appConfig,
        isLoading,
        error,
        setAppConfig,
        refreshConfig: fetchAppConfig,
      }}
    >
      {children}
    </AppConfigContext.Provider>
  );
};

const FALLBACK_CONTEXT: AppConfigContextValue = {
  appConfig: DEFAULT_APP_CONFIG,
  isLoading: false,
  error: null,
  setAppConfig: () => {},
  refreshConfig: async () => {},
};

export function useAppConfig() {
  const ctx = useContext(AppConfigContext);
  return ctx ?? FALLBACK_CONTEXT;
}

export { DEFAULT_APP_CONFIG };
