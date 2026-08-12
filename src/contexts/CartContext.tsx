import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import * as cartService from '../services/cart/cartService';
import { useUser } from './UserContext';
import { logger } from '@/utils/logger';
import { resolveCartLineImageUrl } from '../utils/productImage';
import { capCartQuantity, canIncreaseCartQty } from '../utils/cartConstants';
import {
  cartLineKey,
  findCartLine,
  matchCartLine,
  resolveCartAddPayload,
} from '../utils/cartLineIdentity';
import * as storage from '../utils/storage';

const LINE_QTY_SYNC_DEBOUNCE_MS = 200;

/**
 * How long a just-removed line stays "tombstoned". Within this window any cart
 * payload from the server (stale in-flight GET, overlapping focus/pricing
 * refresh, or eventual replica lag) is prevented from resurrecting the line.
 * Cleared early when the user re-adds the same line.
 */
const REMOVED_TOMBSTONE_TTL_MS = 10000;

export interface CartItem {
  id?: string;
  productId: string;
  productName: string;
  variantId: string;
  variantSize: string;
  /**
   * Historically `any` because callers pass require(), {uri}, strings, etc.
   * Cart fetch normalizes this to a URL string, but add-to-cart flows may still
   * pass non-string sources.
   */
  image: any;
  price: number;
  originalPrice: number;
  gstRate: number;
  discount: string;
  quantity: number;
  /** Master Sheet MaxOrderLimit — null/undefined = unlimited */
  maxOrderLimit?: number | null;
}

export interface CartServerPricing {
  itemTotal: number;
  discount: number;
  deliveryFee: number;
  handlingCharge: number;
  tax: number;
  total: number;
}

interface CartContextType {
  cartItems: CartItem[];
  serverPricing: CartServerPricing;
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
  updateQuantity: (productId: string, variantId: string, quantity: number) => void;
  removeFromCart: (productId: string, variantId: string) => void;
  getLineQuantity: (productId: string, variantId: string) => number;
  /** @deprecated Prefer getLineQuantity(productId, variantId) */
  getItemQuantity: (variantId: string, productId?: string) => number;
  getTotalPrice: () => number;
  getTotalItems: () => number;
  clearCart: () => Promise<void>;
  /** After a failed/cancelled checkout, allow server cart lines to load again. */
  releaseEmptyCartLock: () => void;
  refreshCart: () => Promise<void>;
  refreshCartWithPricingContext: (context: cartService.CartPricingContext) => Promise<void>;
  /** Flush debounced qty updates then reload cart from server (use before checkout/payment). */
  flushAndRefreshCart: (context?: cartService.CartPricingContext) => Promise<void>;
  loading: boolean;
  syncing: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    if (!hasWarnedMissingCartProvider) {
      hasWarnedMissingCartProvider = true;
      logger.warn('useCart called outside CartProvider, using fallback context', {
        domain: 'ui',
        event: 'cart_provider_missing',
      });
    }
    return FALLBACK_CART_CONTEXT;
  }
  return context;
};

let hasWarnedMissingCartProvider = false;

const FALLBACK_CART_CONTEXT: CartContextType = {
  cartItems: [],
  serverPricing: { itemTotal: 0, discount: 0, deliveryFee: 0, handlingCharge: 0, tax: 0, total: 0 },
  addToCart: () => {},
  updateQuantity: () => {},
  removeFromCart: () => {},
  getLineQuantity: () => 0,
  getItemQuantity: () => 0,
  getTotalPrice: () => 0,
  getTotalItems: () => 0,
  clearCart: async () => {},
  releaseEmptyCartLock: () => {},
  refreshCart: async () => {},
  refreshCartWithPricingContext: async () => {},
  flushAndRefreshCart: async () => {},
  loading: false,
  syncing: false,
};

interface CartProviderProps {
  children: ReactNode;
}

function isMongoLineId(id?: string): boolean {
  return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
}

function normalizeCartItemImage(item: Omit<CartItem, 'quantity'> | CartItem): string {
  return resolveCartLineImageUrl({
    productId: item.productId,
    productName: item.productName,
    imageUrl: (item as any).imageUrl,
    thumbnailUrl: (item as any).thumbnailUrl,
    cardImageUrl: (item as any).cardImageUrl,
    images: (item as any).images,
    image: item.image,
  });
}

function mapServerCartToItems(cart: cartService.Cart): CartItem[] {
  return cart.items.map((item) => {
    const payload = resolveCartAddPayload(item.productId, item.variantId);
    return {
      id: (item as any).id ?? (item as any)._id,
      productId: payload.productId,
      productName: item.productName,
      variantId: payload.variantId,
      variantSize: item.variantSize,
      image: resolveCartLineImageUrl({
        productId: payload.productId,
        productName: item.productName,
        imageUrl: (item as any).imageUrl,
        thumbnailUrl: (item as any).thumbnailUrl,
        cardImageUrl: (item as any).cardImageUrl,
        images: (item as any).images,
        image: item.image,
      }),
      price: item.price,
      originalPrice: item.originalPrice ?? item.price,
      gstRate: (item as any).gstRate || 0,
      discount: item.originalPrice && item.originalPrice > item.price
        ? `${Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)}%`
        : '',
      quantity: item.quantity,
      maxOrderLimit: (item as any).maxOrderLimit ?? null,
    };
  });
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cartItemsInternal, setCartItemsInternal] = useState<CartItem[]>([]);
  const cartItems = React.useMemo(
    () => cartItemsInternal.filter((i) => i.quantity > 0),
    [cartItemsInternal],
  );
  const [serverPricing, setServerPricing] = useState<CartServerPricing>({
    itemTotal: 0,
    discount: 0,
    deliveryFee: 0,
    handlingCharge: 0,
    tax: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { isAuthenticated, isRestoring } = useUser();
  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;
  const guestHydratedRef = useRef(false);
  const wasAuthenticatedRef = useRef(false);
  const persistGuestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightMutations = useRef(0);
  const lineQtySyncTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingLineQty = useRef<Map<string, number>>(new Map());
  /**
   * Monotonically increasing counter bumped on every mutation start.
   * fetchCart captures the value before awaiting the network; if it changed
   * by the time the response arrives a mutation happened in between and the
   * fetch response is stale — must be discarded.
   */
  const cartGeneration = useRef(0);
  /** After order placement, block stale server cart lines from refetch until user adds again. */
  const cartMustStayEmpty = useRef(false);
  /** Timestamp of last successful checkout cart clear — used to reject orphan server lines. */
  const checkoutCompletedAt = useRef<number | null>(null);
  /**
   * Recently removed line keys → expiry timestamp. Used to keep a removal
   * "sticky" so a stale or overlapping server cart can't bring the line back.
   */
  const recentlyRemoved = useRef<Map<string, number>>(new Map());

  const pruneTombstones = useCallback(() => {
    if (recentlyRemoved.current.size === 0) return;
    const now = Date.now();
    recentlyRemoved.current.forEach((expiry, key) => {
      if (expiry <= now) recentlyRemoved.current.delete(key);
    });
  }, []);

  const markRemoved = useCallback((key: string) => {
    recentlyRemoved.current.set(key, Date.now() + REMOVED_TOMBSTONE_TTL_MS);
  }, []);

  const clearRemoved = useCallback((key: string) => {
    recentlyRemoved.current.delete(key);
  }, []);

  const dropRecentlyRemoved = useCallback(
    (items: CartItem[]): CartItem[] => {
      pruneTombstones();
      if (recentlyRemoved.current.size === 0) return items;
      return items.filter(
        (it) => !recentlyRemoved.current.has(cartLineKey(it.productId, it.variantId)),
      );
    },
    [pruneTombstones],
  );

  const cartItemsInternalRef = useRef<CartItem[]>([]);
  useEffect(() => {
    cartItemsInternalRef.current = cartItemsInternal;
  }, [cartItemsInternal]);

  const countActiveCartLines = useCallback((items: CartItem[]): number => {
    return items.filter((i) => i.quantity > 0).length;
  }, []);

  const activeLineKeys = useCallback((items: CartItem[]): Set<string> => {
    const keys = new Set<string>();
    for (const item of items) {
      if (item.quantity > 0) {
        keys.add(cartLineKey(item.productId, item.variantId));
      }
    }
    return keys;
  }, []);

  /** Server holds product lines that are not part of the current local cart session. */
  const serverCartHasForeignLines = useCallback(
    (cart: cartService.Cart, localItems: CartItem[]): boolean => {
      const localKeys = activeLineKeys(localItems);
      const serverItems = mapServerCartToItems(cart).filter((i) => i.quantity > 0);
      if (localKeys.size === 0 && serverItems.length > 0) {
        return cartMustStayEmpty.current || checkoutCompletedAt.current != null;
      }
      if (serverItems.length > localKeys.size) return true;
      return serverItems.some(
        (line) => !localKeys.has(cartLineKey(line.productId, line.variantId)),
      );
    },
    [activeLineKeys],
  );

  /** @deprecated use serverCartHasForeignLines */
  const serverCartHasStaleBleed = useCallback(
    (cart: cartService.Cart, localItems: CartItem[]): boolean => {
      return serverCartHasForeignLines(cart, localItems);
    },
    [serverCartHasForeignLines],
  );

  const purgeStaleServerCartLines = useCallback(async (): Promise<void> => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const res = await cartService.clearCart();
        if (res.success) return;
      } catch (err) {
        if (attempt === 2) logger.warn('Failed to purge stale server cart lines', err);
      }
    }
  }, []);

  const applyServerPricing = useCallback((cart: cartService.Cart) => {
    setServerPricing({
      itemTotal: Number(cart.itemTotal || 0),
      discount: Number(cart.discount || 0),
      deliveryFee: Number(cart.deliveryFee || 0),
      handlingCharge: Number(cart.handlingCharge || 0),
      tax: Number(cart.tax || 0),
      total: Number(cart.total || 0),
    });
  }, []);

  const serverCartLineCount = useCallback((cart: cartService.Cart): number => {
    const items = cart?.items;
    if (Array.isArray(items)) {
      return items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
    }
    return mapServerCartToItems(cart).reduce((sum, it) => sum + it.quantity, 0);
  }, []);

  const applyEmptyServerCart = useCallback(() => {
    setCartItemsInternal([]);
    setServerPricing({
      itemTotal: 0,
      discount: 0,
      deliveryFee: 0,
      handlingCharge: 0,
      tax: 0,
      total: 0,
    });
  }, []);

  /** If cart was cleared for a completed order, do not resurrect lines from a stale GET. */
  const reconcileCartAfterOrderClear = useCallback(
    async (cart: cartService.Cart): Promise<cartService.Cart> => {
      if (!cartMustStayEmpty.current) return cart;
      if (serverCartLineCount(cart) === 0) return cart;
      logger.warn('Server cart still has items after order clear — re-clearing', {
        lineCount: serverCartLineCount(cart),
      });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const cleared = await cartService.clearCart();
          if (cleared.success) break;
        } catch (err) {
          if (attempt === 2) logger.warn('Re-clear cart after order failed', err);
        }
      }
      return {
        ...cart,
        items: [],
        itemTotal: 0,
        discount: 0,
        deliveryFee: 0,
        handlingCharge: 0,
        tax: 0,
        total: 0,
      };
    },
    [serverCartLineCount],
  );

  const applyServerCart = useCallback(
    (cart: cartService.Cart) => {
      if (cartMustStayEmpty.current) return;
      setCartItemsInternal(dropRecentlyRemoved(mapServerCartToItems(cart)));
      applyServerPricing(cart);
    },
    [applyServerPricing, dropRecentlyRemoved],
  );

  const hasPendingOptimisticEdits = useCallback((): boolean => {
    return (
      inFlightMutations.current > 0 ||
      pendingLineQty.current.size > 0 ||
      lineQtySyncTimers.current.size > 0
    );
  }, []);

  const effectiveLocalLineQuantity = useCallback(
    (line: CartItem | undefined, productId: string, variantId: string): number => {
      const key = cartLineKey(productId, variantId);
      const pending = pendingLineQty.current.get(key);
      if (pending != null) return pending;
      return line?.quantity ?? 0;
    },
    [],
  );

  /**
   * Merge server cart with in-flight optimistic edits (adds, qty changes, removals).
   * Always applied so rapid taps stay instant without waiting for a full re-fetch.
   */
  const applyServerCartWithPendingMutations = useCallback(
    (cart: cartService.Cart) => {
      if (cartMustStayEmpty.current) return;
      const serverItems = dropRecentlyRemoved(mapServerCartToItems(cart));
      const mutationInFlight = hasPendingOptimisticEdits();
      setCartItemsInternal((prev) => {
        const localActive = prev.filter((line) => {
          const qty = effectiveLocalLineQuantity(line, line.productId, line.variantId);
          return qty > 0;
        });
        const hasLocalSession = localActive.length > 0 || mutationInFlight;

        const merged = serverItems
          .map((serverLine) => {
            const local = findCartLine(prev, serverLine.productId, serverLine.variantId);
            const localQty = effectiveLocalLineQuantity(
              local,
              serverLine.productId,
              serverLine.variantId,
            );
            if (!local) {
              // Never import server-only lines mid-session — those are usually a previous order.
              if (hasLocalSession) return null;
              if (localQty <= 0) return serverLine;
              return null;
            }
            if (localQty === 0) return null;
            if (
              checkoutCompletedAt.current != null ||
              localQty > serverLine.quantity ||
              (mutationInFlight && localQty !== serverLine.quantity)
            ) {
              return { ...serverLine, quantity: localQty };
            }
            return serverLine;
          })
          .filter((line): line is CartItem => line != null);
        const onlyLocal = prev
          .map((localLine) => {
            const localQty = effectiveLocalLineQuantity(
              localLine,
              localLine.productId,
              localLine.variantId,
            );
            if (localQty <= 0) return null;
            if (findCartLine(serverItems, localLine.productId, localLine.variantId)) {
              return null;
            }
            return { ...localLine, quantity: localQty };
          })
          .filter((line): line is CartItem => line != null);
        return onlyLocal.length > 0 ? [...merged, ...onlyLocal] : merged;
      });
      applyServerPricing(cart);
    },
    [applyServerPricing, effectiveLocalLineQuantity, hasPendingOptimisticEdits, dropRecentlyRemoved],
  );

  const resyncLocalLinesToServer = useCallback(async (localActive: CartItem[]): Promise<void> => {
    for (const line of localActive) {
      try {
        await cartService.addToCart({
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
        });
      } catch (err) {
        logger.warn('Failed to resync cart line to server after purge', err);
      }
    }
  }, []);

  const applyCartResponseGuardingStaleLines = useCallback(
    async (cart: cartService.Cart, opts?: { preferLocalIfHigher?: boolean }) => {
      if (cartMustStayEmpty.current) {
        const localActive = cartItemsInternalRef.current.filter((i) => i.quantity > 0);
        if (localActive.length > 0) {
          return;
        }
        applyEmptyServerCart();
        return;
      }
      const localItems = cartItemsInternalRef.current;
      if (serverCartHasForeignLines(cart, localItems)) {
        logger.warn('Stale server cart lines from previous order — purging server cart', {
          serverLines: countActiveCartLines(mapServerCartToItems(cart)),
          localLines: countActiveCartLines(localItems),
        });
        await purgeStaleServerCartLines();
        const localActive = localItems.filter((i) => i.quantity > 0);
        if (localActive.length > 0) {
          setCartItemsInternal(localActive);
          await resyncLocalLinesToServer(localActive);
        } else {
          applyEmptyServerCart();
        }
        return;
      }
      checkoutCompletedAt.current = null;
      if (opts?.preferLocalIfHigher) {
        applyServerCartWithPendingMutations(cart);
      } else {
        applyServerCart(cart);
      }
    },
    [
      applyEmptyServerCart,
      applyServerCart,
      applyServerCartWithPendingMutations,
      countActiveCartLines,
      purgeStaleServerCartLines,
      resyncLocalLinesToServer,
      serverCartHasForeignLines,
    ],
  );

  const syncLatestCart = useCallback(async (): Promise<boolean> => {
    if (cartMustStayEmpty.current) return true;
    if (!isAuthenticatedRef.current) return true;
    try {
      const latest = await cartService.getCart();
      if (latest.success && latest.data) {
        await applyCartResponseGuardingStaleLines(latest.data, { preferLocalIfHigher: true });
        return true;
      }
      return false;
    } catch (err) {
      logger.warn('Failed to refresh latest cart after mutation', err);
      return false;
    }
  }, [applyCartResponseGuardingStaleLines]);

  const beginMutation = useCallback(() => {
    inFlightMutations.current += 1;
    cartGeneration.current += 1;
  }, []);

  const endMutation = useCallback(() => {
    inFlightMutations.current = Math.max(0, inFlightMutations.current - 1);
  }, []);

  const cancelLineQtySync = useCallback(
    (productId: string, variantId: string) => {
      const key = cartLineKey(productId, variantId);
      const hadPendingSync =
        lineQtySyncTimers.current.has(key) || pendingLineQty.current.has(key);
      const timer = lineQtySyncTimers.current.get(key);
      if (timer) {
        clearTimeout(timer);
        lineQtySyncTimers.current.delete(key);
      }
      pendingLineQty.current.delete(key);
      if (hadPendingSync) {
        endMutation();
      }
    },
    [endMutation],
  );

  /** Drop debounced qty syncs and invalidate in-flight cart responses after checkout. */
  const cancelAllPendingCartSync = useCallback(() => {
    lineQtySyncTimers.current.forEach((timer) => clearTimeout(timer));
    lineQtySyncTimers.current.clear();
    pendingLineQty.current.clear();
    inFlightMutations.current = 0;
    cartGeneration.current += 1;
  }, []);

  const applyMutationCartResponse = useCallback(
    async (
      res: Awaited<ReturnType<typeof cartService.getCart>> | undefined,
      opts?: { preferLocalIfHigher?: boolean },
    ): Promise<boolean> => {
      if (cartMustStayEmpty.current) return false;
      if (!res?.success || !res.data) return false;
      await applyCartResponseGuardingStaleLines(res.data, opts);
      return true;
    },
    [applyCartResponseGuardingStaleLines],
  );

  const flushPendingCartSync = useCallback(async () => {
    const keys = Array.from(pendingLineQty.current.keys());
    for (const key of keys) {
      const timer = lineQtySyncTimers.current.get(key);
      if (timer) {
        clearTimeout(timer);
        lineQtySyncTimers.current.delete(key);
      }
      const qty = pendingLineQty.current.get(key);
      pendingLineQty.current.delete(key);
      if (qty == null) continue;
      const sep = key.indexOf('::');
      if (sep <= 0) continue;
      const productId = key.slice(0, sep);
      const variantId = key.slice(sep + 2);
      try {
        await cartService.updateCartItemByProduct({ productId, variantId, quantity: qty });
      } catch (err) {
        logger.warn('Failed to flush cart line quantity', err);
      }
    }
    let waitMs = 0;
    while (inFlightMutations.current > 0 && waitMs < 5000) {
      await new Promise((r) => setTimeout(r, 50));
      waitMs += 50;
    }
  }, []);

  const fetchCart = useCallback(
    async (context?: cartService.CartPricingContext, opts?: { force?: boolean }) => {
      if (!isAuthenticatedRef.current) {
        return;
      }
      if (opts?.force) {
        if (cartMustStayEmpty.current) {
          cancelAllPendingCartSync();
        } else {
          await flushPendingCartSync();
        }
      } else if (hasPendingOptimisticEdits()) {
        return;
      }
      // Capture generation before the async gap — if a mutation starts while
      // this fetch is in-flight the generation will have bumped and the
      // response is stale (server state predates the mutation).
      const genAtStart = cartGeneration.current;
      try {
        setLoading(true);
        const res = await cartService.getCart(context);
        if (
          res.success &&
          res.data &&
          !hasPendingOptimisticEdits() &&
          cartGeneration.current === genAtStart
        ) {
          const cart = await reconcileCartAfterOrderClear(res.data);
          await applyCartResponseGuardingStaleLines(cart, { preferLocalIfHigher: true });
        }
      } catch (err) {
        logger.warn('Failed to fetch cart from server', err);
      } finally {
        setLoading(false);
      }
    },
    [
      applyCartResponseGuardingStaleLines,
      cancelAllPendingCartSync,
      flushPendingCartSync,
      hasPendingOptimisticEdits,
      reconcileCartAfterOrderClear,
    ],
  );

  const flushAndRefreshCart = useCallback(
    async (context?: cartService.CartPricingContext) => {
      if (!isAuthenticatedRef.current) {
        return;
      }
      if (cartMustStayEmpty.current) {
        cancelAllPendingCartSync();
      } else {
        await flushPendingCartSync();
      }
      try {
        setLoading(true);
        const res = await cartService.getCart(context);
        if (res.success && res.data) {
          const cart = await reconcileCartAfterOrderClear(res.data);
          await applyCartResponseGuardingStaleLines(cart);
        }
      } catch (err) {
        logger.warn('Failed to flush and refresh cart', err);
      } finally {
        setLoading(false);
      }
    },
    [
      applyCartResponseGuardingStaleLines,
      cancelAllPendingCartSync,
      flushPendingCartSync,
      reconcileCartAfterOrderClear,
    ],
  );

  const releaseEmptyCartLock = useCallback(() => {
    cartMustStayEmpty.current = false;
    checkoutCompletedAt.current = null;
  }, []);

  const mergeGuestCartThenFetch = useCallback(async () => {
    try {
      const raw = await storage.getGuestCart();
      if (raw) {
        let guestItems: CartItem[] = [];
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            guestItems = parsed.filter(
              (it: any) =>
                it &&
                typeof it.productId === 'string' &&
                typeof it.variantId === 'string' &&
                Number(it.quantity) > 0,
            );
          }
        } catch {
          guestItems = [];
        }
        if (guestItems.length > 0) {
          const mergeKey = await storage.getOrCreateGuestCartMergeKey();
          try {
            const merged = await cartService.mergeGuestCart({
              mergeKey,
              items: guestItems.map((it) => ({
                productId: it.productId,
                variantId: it.variantId,
                quantity: it.quantity,
              })),
            });
            if (merged.success && merged.data) {
              await applyCartResponseGuardingStaleLines(merged.data, {
                preferLocalIfHigher: true,
              });
            }
          } catch (err) {
            logger.warn('Guest cart merge failed; will fetch server cart and keep local lines', err);
          }
          await storage.clearGuestCart();
        }
      }
    } catch (err) {
      logger.warn('Failed preparing guest cart merge', err);
    }
    await fetchCart(undefined, { force: true });
  }, [applyCartResponseGuardingStaleLines, fetchCart]);

  const hydrateGuestCart = useCallback(async () => {
    if (guestHydratedRef.current) return;
    guestHydratedRef.current = true;
    try {
      const raw = await storage.getGuestCart();
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      if (isAuthenticatedRef.current) return;
      const items = parsed
        .filter(
          (it: any) =>
            it &&
            typeof it.productId === 'string' &&
            typeof it.variantId === 'string' &&
            Number(it.quantity) > 0,
        )
        .map((it: CartItem) => ({
          ...it,
          quantity: capCartQuantity(Math.max(0, Number(it.quantity) || 0), it.maxOrderLimit),
          image: normalizeCartItemImage(it),
        }));
      if (items.length > 0 && !isAuthenticatedRef.current) {
        setCartItemsInternal(items);
      }
    } catch (err) {
      logger.warn('Failed to hydrate guest cart', err);
    }
  }, []);

  // Auth / guest lifecycle — never wipe guest cart; merge into server on login.
  useEffect(() => {
    if (isRestoring) return;

    if (isAuthenticated) {
      wasAuthenticatedRef.current = true;
      guestHydratedRef.current = true;
      void mergeGuestCartThenFetch();
      return;
    }

    // Logged out / guest: keep in-memory cart (convert to guest) or hydrate from storage.
    cartMustStayEmpty.current = false;
    checkoutCompletedAt.current = null;
    if (wasAuthenticatedRef.current) {
      wasAuthenticatedRef.current = false;
      // Persist whatever is currently in the cart as the guest cart.
      const active = cartItemsInternalRef.current.filter((i) => i.quantity > 0);
      void storage.saveGuestCart(JSON.stringify(active));
      return;
    }

    void hydrateGuestCart();
  }, [isAuthenticated, isRestoring, mergeGuestCartThenFetch, hydrateGuestCart]);

  // Persist guest cart after local edits (debounced).
  useEffect(() => {
    if (isRestoring || isAuthenticated || !guestHydratedRef.current) return;
    if (persistGuestTimer.current) clearTimeout(persistGuestTimer.current);
    persistGuestTimer.current = setTimeout(() => {
      const active = cartItemsInternal.filter((i) => i.quantity > 0);
      void storage.saveGuestCart(JSON.stringify(active));
    }, 150);
    return () => {
      if (persistGuestTimer.current) clearTimeout(persistGuestTimer.current);
    };
  }, [cartItemsInternal, isAuthenticated, isRestoring]);

  useEffect(
    () => () => {
      lineQtySyncTimers.current.forEach((timer) => clearTimeout(timer));
      lineQtySyncTimers.current.clear();
      pendingLineQty.current.clear();
      if (persistGuestTimer.current) clearTimeout(persistGuestTimer.current);
    },
    [],
  );

  const refreshCart = useCallback(async () => {
    await fetchCart(undefined, { force: true });
  }, [fetchCart]);

  const refreshCartWithPricingContext = useCallback(
    async (context: cartService.CartPricingContext) => {
      await fetchCart(context, { force: true });
    },
    [fetchCart],
  );

  const addToCart = useCallback(
    (item: Omit<CartItem, 'quantity'>) => {
      const normalizedImage = normalizeCartItemImage(item);
      const payload = resolveCartAddPayload(item.productId, item.variantId);
      cancelLineQtySync(payload.productId, payload.variantId);
      clearRemoved(cartLineKey(payload.productId, payload.variantId));
      beginMutation();

      setCartItemsInternal((prev) => {
        const existing = findCartLine(prev, payload.productId, payload.variantId);
        const limit = existing?.maxOrderLimit ?? item.maxOrderLimit;
        if (existing && !canIncreaseCartQty(existing.quantity, limit)) {
          return prev;
        }
        if (existing) {
          return prev.map((i) =>
            matchCartLine(i, payload.productId, payload.variantId)
              ? {
                  ...i,
                  quantity: capCartQuantity(i.quantity + 1, limit),
                  maxOrderLimit: limit ?? i.maxOrderLimit,
                }
              : i,
          );
        }
        return [
          ...prev,
          {
            ...item,
            ...payload,
            image: normalizedImage,
            quantity: 1,
            maxOrderLimit: item.maxOrderLimit ?? null,
          },
        ];
      });

      void (async () => {
        // Guest / unauthenticated: local cart is the source of truth (persisted).
        if (!isAuthenticatedRef.current) {
          cartMustStayEmpty.current = false;
          checkoutCompletedAt.current = null;
          endMutation();
          return;
        }

        const startingNewOrderSession = cartMustStayEmpty.current;
        try {
          if (startingNewOrderSession) {
            cancelAllPendingCartSync();
            cartMustStayEmpty.current = false;
            await purgeStaleServerCartLines();
          }

          const res = await cartService.addToCart({
            productId: payload.productId,
            variantId: payload.variantId,
            quantity: 1,
          });

          if (startingNewOrderSession && res.success && res.data) {
            if (serverCartHasForeignLines(res.data, cartItemsInternalRef.current)) {
              await purgeStaleServerCartLines();
              const retry = await cartService.addToCart({
                productId: payload.productId,
                variantId: payload.variantId,
                quantity: 1,
              });
              if (!(await applyMutationCartResponse(retry, { preferLocalIfHigher: true }))) {
                await syncLatestCart();
              }
              checkoutCompletedAt.current = null;
              return;
            }
          }

          if (!(await applyMutationCartResponse(res, { preferLocalIfHigher: true }))) {
            await syncLatestCart();
          }
          checkoutCompletedAt.current = null;
        } catch (err) {
          // Keep optimistic local cart — never roll back on API/network failure.
          // Rolling back caused View Cart to flash then disappear (guest 401 / offline).
          logger.warn('addToCart API failed; keeping local cart until next successful sync', err);
          await syncLatestCart();
        } finally {
          endMutation();
        }
      })();
    },
    [
      beginMutation,
      endMutation,
      applyMutationCartResponse,
      syncLatestCart,
      cancelLineQtySync,
      cancelAllPendingCartSync,
      clearRemoved,
      purgeStaleServerCartLines,
      serverCartHasForeignLines,
    ],
  );

  const removeFromCart = useCallback(
    (productId: string, variantId: string) => {
      const linePayload = resolveCartAddPayload(productId, variantId);
      const lineKey = cartLineKey(linePayload.productId, linePayload.variantId);
      cancelLineQtySync(linePayload.productId, linePayload.variantId);
      beginMutation();
      let removedSnapshot: CartItem | undefined;

      // Tombstone first so any server payload that lands while the delete is
      // in-flight (or shortly after) cannot resurrect the line, then drop it
      // from local state entirely for an instant, durable removal.
      markRemoved(lineKey);
      setCartItemsInternal((prev) => {
        removedSnapshot = findCartLine(prev, linePayload.productId, linePayload.variantId);
        return prev.filter(
          (i) => !matchCartLine(i, linePayload.productId, linePayload.variantId),
        );
      });

      if (!removedSnapshot) {
        clearRemoved(lineKey);
        endMutation();
        return;
      }

      if (!isAuthenticatedRef.current) {
        endMutation();
        return;
      }

      const run = isMongoLineId(removedSnapshot.id)
        ? cartService.removeFromCart(removedSnapshot.id!, {
            productId: linePayload.productId,
            variantId: linePayload.variantId,
          })
        : cartService.updateCartItemByProduct({
            productId: linePayload.productId,
            variantId: linePayload.variantId,
            quantity: 0,
          });

      run
        .then(async (res) => {
          try {
            if (!res?.success) {
              await syncLatestCart();
              return;
            }
            await applyCartResponseGuardingStaleLines(res.data!, { preferLocalIfHigher: true });
          } finally {
            endMutation();
          }
        })
        .catch(async (err) => {
          try {
            logger.warn('removeFromCart API failed; keeping local removal', err);
            await syncLatestCart();
          } finally {
            endMutation();
          }
        });
    },
    [
      beginMutation,
      endMutation,
      applyCartResponseGuardingStaleLines,
      syncLatestCart,
      cancelLineQtySync,
      markRemoved,
      clearRemoved,
    ],
  );

  const updateQuantity = useCallback(
    (productId: string, variantId: string, quantity: number) => {
      const linePayload = resolveCartAddPayload(productId, variantId);
      const existingLine = findCartLine(cartItemsInternalRef.current, linePayload.productId, linePayload.variantId);
      const cappedQuantity = capCartQuantity(quantity, existingLine?.maxOrderLimit);
      if (quantity <= 0) {
        removeFromCart(linePayload.productId, linePayload.variantId);
        return;
      }

      clearRemoved(cartLineKey(linePayload.productId, linePayload.variantId));

      let appliedOptimistic = false;
      setCartItemsInternal((prev) => {
        const existing = findCartLine(prev, linePayload.productId, linePayload.variantId);
        if (!existing) return prev;
        appliedOptimistic = true;
        return prev.map((i) =>
          matchCartLine(i, linePayload.productId, linePayload.variantId)
            ? { ...i, quantity: cappedQuantity }
            : i,
        );
      });

      if (!appliedOptimistic) {
        return;
      }

      const lineKey = cartLineKey(linePayload.productId, linePayload.variantId);
      const isNewDebounceBatch = !lineQtySyncTimers.current.has(lineKey);
      pendingLineQty.current.set(lineKey, cappedQuantity);
      const pendingTimer = lineQtySyncTimers.current.get(lineKey);
      if (pendingTimer) clearTimeout(pendingTimer);

      if (isNewDebounceBatch) {
        beginMutation();
      }

      lineQtySyncTimers.current.set(
        lineKey,
        setTimeout(() => {
          lineQtySyncTimers.current.delete(lineKey);
          const quantityToSync = pendingLineQty.current.get(lineKey);
          pendingLineQty.current.delete(lineKey);
          if (quantityToSync == null) {
            endMutation();
            return;
          }

          if (!isAuthenticatedRef.current) {
            endMutation();
            return;
          }

          cartService
            .updateCartItemByProduct({
              productId: linePayload.productId,
              variantId: linePayload.variantId,
              quantity: quantityToSync,
            })
            .then(async (res) => {
              try {
                if (!(await applyMutationCartResponse(res, { preferLocalIfHigher: true }))) {
                  await syncLatestCart();
                }
              } finally {
                endMutation();
              }
            })
            .catch(async (err) => {
              try {
                logger.warn('updateCartItem API failed; keeping local quantity', err);
                await syncLatestCart();
              } finally {
                endMutation();
              }
            });
        }, LINE_QTY_SYNC_DEBOUNCE_MS),
      );
    },
    [
      beginMutation,
      endMutation,
      applyMutationCartResponse,
      removeFromCart,
      syncLatestCart,
      clearRemoved,
    ],
  );

  const getLineQuantity = useCallback(
    (productId: string, variantId: string): number => {
      const linePayload = resolveCartAddPayload(productId, variantId);
      const key = cartLineKey(linePayload.productId, linePayload.variantId);
      const pending = pendingLineQty.current.get(key);
      if (pending != null) return pending;
      const line = findCartLine(cartItems, linePayload.productId, linePayload.variantId);
      return line ? line.quantity : 0;
    },
    [cartItems],
  );

  const getItemQuantity = useCallback(
    (variantId: string, productId?: string): number => {
      if (productId) {
        return getLineQuantity(productId, variantId);
      }
      const line = cartItems.find((i) => i.variantId === variantId);
      if (line) return line.quantity;
      return cartItems.find((i) => matchCartLine(i, i.productId, variantId))?.quantity ?? 0;
    },
    [cartItems, getLineQuantity],
  );

  const getTotalPrice = useCallback((): number => {
    return cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  }, [cartItems]);

  const getTotalItems = useCallback((): number => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  }, [cartItems]);

  const clearCartFn = useCallback(async (): Promise<void> => {
    cancelAllPendingCartSync();
    beginMutation();
    cartMustStayEmpty.current = true;
    checkoutCompletedAt.current = Date.now();

    recentlyRemoved.current.clear();
    applyEmptyServerCart();
    void storage.clearGuestCart();

    try {
      if (!isAuthenticatedRef.current) {
        return;
      }
      let clearedOnServer = false;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const res = await cartService.clearCart();
          if (res.success) {
            clearedOnServer = true;
            break;
          }
        } catch (err) {
          if (attempt === 2) {
            logger.error('clearCart API failed after retries; cart locked empty locally', err);
          }
        }
      }
      if (!clearedOnServer) {
        logger.warn('clearCart API did not confirm success; stale server lines will be rejected on refetch');
      }
    } finally {
      endMutation();
    }
  }, [applyEmptyServerCart, beginMutation, cancelAllPendingCartSync, endMutation]);

  const value: CartContextType = useMemo(
    () => ({
      cartItems,
      serverPricing,
      addToCart,
      updateQuantity,
      removeFromCart,
      getLineQuantity,
      getItemQuantity,
      getTotalPrice,
      getTotalItems,
      clearCart: clearCartFn,
      releaseEmptyCartLock,
      refreshCart,
      refreshCartWithPricingContext,
      flushAndRefreshCart,
      loading,
      syncing,
    }),
    [
      cartItems,
      serverPricing,
      addToCart,
      updateQuantity,
      removeFromCart,
      getLineQuantity,
      getItemQuantity,
      getTotalPrice,
      getTotalItems,
      clearCartFn,
      releaseEmptyCartLock,
      refreshCart,
      refreshCartWithPricingContext,
      flushAndRefreshCart,
      loading,
      syncing,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
