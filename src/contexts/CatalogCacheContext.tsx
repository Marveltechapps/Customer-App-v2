import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { AppConfigData } from './AppConfigContext';
import { useAppConfig } from './AppConfigContext';
import {
  categoryService,
  type CategoryPayloadResponse,
} from '../services/category/categoryService';
import type { Coupon } from '../services/coupons/couponService';
import {
  fetchHomeCouponsList,
  loadCatalogBootstrapSession,
  mapHomePayloadToCategoryGroups,
  type CategoryGroup,
  type HomeConfigState,
} from '../utils/catalogCacheLoaders';

function categoryPayloadCacheKey(categoryId: string, subCategoryId?: string | null): string {
  return subCategoryId ? `${categoryId}:${subCategoryId}` : categoryId;
}

interface CatalogCacheContextValue {
  bootstrapData: Record<string, unknown> | null;
  cmsBlocks: any[] | null;
  homeConfig: HomeConfigState;
  homeCoupons: Coupon[];
  categoryGroups: CategoryGroup[] | null;
  homeLoading: boolean;
  homeError: string | null;
  categoriesLoading: boolean;
  catalogLoaded: boolean;
  ensureCatalogLoaded: () => Promise<void>;
  reloadCatalog: () => Promise<void>;
  fetchCategoryPayloadCached: (
    categoryId: string,
    subCategoryId?: string | null,
  ) => Promise<CategoryPayloadResponse>;
}

const CatalogCacheContext = createContext<CatalogCacheContextValue | undefined>(undefined);

export const CatalogCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setAppConfig } = useAppConfig();

  const [bootstrapData, setBootstrapData] = useState<Record<string, unknown> | null>(null);
  const [cmsBlocks, setCmsBlocks] = useState<any[] | null>(null);
  const [homeConfig, setHomeConfig] = useState<HomeConfigState>(null);
  const [homeCoupons, setHomeCoupons] = useState<Coupon[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[] | null>(null);
  const [homeLoading, setHomeLoading] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  const catalogLoadedRef = useRef(false);
  const loadPromiseRef = useRef<Promise<void> | null>(null);
  const categoryPayloadCacheRef = useRef(new Map<string, CategoryPayloadResponse>());
  const categoryPayloadInflightRef = useRef(new Map<string, Promise<CategoryPayloadResponse>>());

  const runCatalogLoad = useCallback(async () => {
    setHomeLoading(true);
    setCategoriesLoading(true);
    setHomeError(null);

    try {
      const [bootstrapResult, groups, coupons] = await Promise.all([
        loadCatalogBootstrapSession(),
        mapHomePayloadToCategoryGroups(),
        fetchHomeCouponsList(),
      ]);

      if (bootstrapResult.bootstrapData) {
        setBootstrapData(bootstrapResult.bootstrapData);
      }
      if (bootstrapResult.homeConfig) {
        setHomeConfig(bootstrapResult.homeConfig);
      }
      if (bootstrapResult.cmsBlocks !== null) {
        setCmsBlocks(bootstrapResult.cmsBlocks);
      } else if (bootstrapResult.homeError) {
        setCmsBlocks((prev) => (Array.isArray(prev) && prev.length > 0 ? prev : []));
      }
      if (bootstrapResult.appConfig) {
        setAppConfig(bootstrapResult.appConfig as AppConfigData);
      }
      if (bootstrapResult.homeError) {
        setHomeError(bootstrapResult.homeError);
      } else {
        setHomeError(null);
      }

      setCategoryGroups(groups);
      setHomeCoupons(coupons);
      catalogLoadedRef.current = true;
      setCatalogLoaded(true);
    } finally {
      setHomeLoading(false);
      setCategoriesLoading(false);
    }
  }, [setAppConfig]);

  const ensureCatalogLoaded = useCallback(async () => {
    if (catalogLoadedRef.current) return;
    if (loadPromiseRef.current) {
      await loadPromiseRef.current;
      return;
    }
    const promise = runCatalogLoad().finally(() => {
      loadPromiseRef.current = null;
    });
    loadPromiseRef.current = promise;
    await promise;
  }, [runCatalogLoad]);

  const reloadCatalog = useCallback(async () => {
    catalogLoadedRef.current = false;
    categoryPayloadCacheRef.current.clear();
    categoryPayloadInflightRef.current.clear();
    setCatalogLoaded(false);
    loadPromiseRef.current = null;
    await runCatalogLoad();
    catalogLoadedRef.current = true;
    setCatalogLoaded(true);
  }, [runCatalogLoad]);

  const fetchCategoryPayloadCached = useCallback(
    async (categoryId: string, subCategoryId?: string | null): Promise<CategoryPayloadResponse> => {
      const key = categoryPayloadCacheKey(categoryId, subCategoryId);
      const cached = categoryPayloadCacheRef.current.get(key);
      if (cached) return cached;

      const inflight = categoryPayloadInflightRef.current.get(key);
      if (inflight) return inflight;

      const request = categoryService
        .getCategoryPayload(categoryId, subCategoryId)
        .then((res) => {
          if (res?.success) {
            categoryPayloadCacheRef.current.set(key, res);
          }
          return res;
        })
        .finally(() => {
          categoryPayloadInflightRef.current.delete(key);
        });

      categoryPayloadInflightRef.current.set(key, request);
      return request;
    },
    [],
  );

  useEffect(() => {
    void ensureCatalogLoaded();
  }, [ensureCatalogLoaded]);

  const value: CatalogCacheContextValue = {
    bootstrapData,
    cmsBlocks,
    homeConfig,
    homeCoupons,
    categoryGroups,
    homeLoading,
    homeError,
    categoriesLoading,
    catalogLoaded,
    ensureCatalogLoaded,
    reloadCatalog,
    fetchCategoryPayloadCached,
  };

  return <CatalogCacheContext.Provider value={value}>{children}</CatalogCacheContext.Provider>;
};

export function useCatalogCache(): CatalogCacheContextValue {
  const ctx = useContext(CatalogCacheContext);
  if (!ctx) throw new Error('useCatalogCache must be used within CatalogCacheProvider');
  return ctx;
}

/** @deprecated Use useCatalogCache — kept for compatibility */
export function useHome() {
  const cache = useCatalogCache();
  return {
    homeData: cache.bootstrapData,
    setHomeData: () => {
      /* session cache is read-only after initial load */
    },
  };
}

export const HomeProvider = CatalogCacheProvider;

export default CatalogCacheContext;
