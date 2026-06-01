import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import * as cartService from '../services/cart/cartService';
import { useUser } from './UserContext';
import { logger } from '@/utils/logger';
import { resolveCartLineImageUrl } from '../utils/productImage';
import { MAX_CART_QTY_PER_ITEM } from '../utils/cartConstants';
import {
  cartLineKey,
  findCartLine,
  matchCartLine,
  resolveCartAddPayload,
} from '../utils/cartLineIdentity';

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
  const { isAuthenticated } = useUser();
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

  const applyServerCart = useCallback(
    (cart: cartService.Cart) => {
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
      const serverItems = dropRecentlyRemoved(mapServerCartToItems(cart));
      const mutationInFlight = hasPendingOptimisticEdits();
      setCartItemsInternal((prev) => {
        const merged = serverItems
          .map((serverLine) => {
            const local = findCartLine(prev, serverLine.productId, serverLine.variantId);
            const localQty = effectiveLocalLineQuantity(
              local,
              serverLine.productId,
              serverLine.variantId,
            );
            if (!local && localQty <= 0) return serverLine;
            if (localQty === 0) return null;
            if (
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

  const syncLatestCart = useCallback(async (): Promise<boolean> => {
    try {
      const latest = await cartService.getCart();
      if (latest.success && latest.data) {
        applyServerCartWithPendingMutations(latest.data);
        return true;
      }
      return false;
    } catch (err) {
      logger.warn('Failed to refresh latest cart after mutation', err);
      return false;
    }
  }, [applyServerCartWithPendingMutations]);

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

  const applyMutationCartResponse = useCallback(
    (
      res: Awaited<ReturnType<typeof cartService.getCart>> | undefined,
      opts?: { preferLocalIfHigher?: boolean },
    ): boolean => {
      if (!res?.success || !res.data) return false;
      if (opts?.preferLocalIfHigher) {
        applyServerCartWithPendingMutations(res.data);
      } else {
        applyServerCart(res.data);
      }
      return true;
    },
    [applyServerCart, applyServerCartWithPendingMutations],
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
      if (opts?.force) {
        await flushPendingCartSync();
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
          applyServerCartWithPendingMutations(res.data);
        }
      } catch (err) {
        logger.warn('Failed to fetch cart from server', err);
      } finally {
        setLoading(false);
      }
    },
    [applyServerCartWithPendingMutations, flushPendingCartSync, hasPendingOptimisticEdits],
  );

  const flushAndRefreshCart = useCallback(
    async (context?: cartService.CartPricingContext) => {
      await flushPendingCartSync();
      try {
        setLoading(true);
        const res = await cartService.getCart(context);
        if (res.success && res.data) {
          applyServerCart(res.data);
        }
      } catch (err) {
        logger.warn('Failed to flush and refresh cart', err);
      } finally {
        setLoading(false);
      }
    },
    [applyServerCart, flushPendingCartSync],
  );

  useEffect(() => {
    if (isAuthenticated) {
      fetchCart(undefined, { force: true });
    } else {
      recentlyRemoved.current.clear();
      setCartItemsInternal([]);
      setServerPricing({ itemTotal: 0, discount: 0, deliveryFee: 0, handlingCharge: 0, tax: 0, total: 0 });
    }
  }, [isAuthenticated, fetchCart]);

  useEffect(
    () => () => {
      lineQtySyncTimers.current.forEach((timer) => clearTimeout(timer));
      lineQtySyncTimers.current.clear();
      pendingLineQty.current.clear();
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
      // Re-adding a line lifts any pending removal tombstone so it can show again.
      clearRemoved(cartLineKey(payload.productId, payload.variantId));
      beginMutation();

      setCartItemsInternal((prev) => {
        const existing = findCartLine(prev, payload.productId, payload.variantId);
        if (existing && existing.quantity >= MAX_CART_QTY_PER_ITEM) {
          return prev;
        }
        if (existing) {
          return prev.map((i) =>
            matchCartLine(i, payload.productId, payload.variantId)
              ? { ...i, quantity: Math.min(MAX_CART_QTY_PER_ITEM, i.quantity + 1) }
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
          },
        ];
      });

      cartService
        .addToCart({
          productId: payload.productId,
          variantId: payload.variantId,
          quantity: 1,
        })
        .then(async (res) => {
          try {
            if (!applyMutationCartResponse(res, { preferLocalIfHigher: true })) {
              await syncLatestCart();
            }
          } finally {
            endMutation();
          }
        })
        .catch(async (err) => {
          try {
            logger.warn('addToCart API failed, syncing latest cart', err);
            const synced = await syncLatestCart();
            if (!synced) {
              setCartItemsInternal((prev) => {
                const line = findCartLine(prev, payload.productId, payload.variantId);
                if (!line || line.quantity <= 1) {
                  return prev.filter(
                    (i) => !matchCartLine(i, payload.productId, payload.variantId),
                  );
                }
                return prev.map((i) =>
                  matchCartLine(i, payload.productId, payload.variantId)
                    ? { ...i, quantity: i.quantity - 1 }
                    : i,
                );
              });
            }
          } finally {
            endMutation();
          }
        });
    },
    [beginMutation, endMutation, applyMutationCartResponse, syncLatestCart, cancelLineQtySync, clearRemoved],
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
            applyServerCart(res.data!);
          } finally {
            endMutation();
          }
        })
        .catch(async (err) => {
          try {
            logger.warn('removeFromCart API failed, syncing latest cart', err);
            await syncLatestCart();
          } finally {
            endMutation();
          }
        });
    },
    [
      beginMutation,
      endMutation,
      applyServerCart,
      syncLatestCart,
      cancelLineQtySync,
      markRemoved,
      clearRemoved,
    ],
  );

  const updateQuantity = useCallback(
    (productId: string, variantId: string, quantity: number) => {
      const linePayload = resolveCartAddPayload(productId, variantId);
      const cappedQuantity = Math.min(MAX_CART_QTY_PER_ITEM, quantity);
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

          cartService
            .updateCartItemByProduct({
              productId: linePayload.productId,
              variantId: linePayload.variantId,
              quantity: quantityToSync,
            })
            .then(async (res) => {
              try {
                if (!applyMutationCartResponse(res, { preferLocalIfHigher: true })) {
                  await syncLatestCart();
                }
              } finally {
                endMutation();
              }
            })
            .catch(async (err) => {
              try {
                logger.warn('updateCartItem API failed, syncing latest cart', err);
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
    beginMutation();

    recentlyRemoved.current.clear();
    setCartItemsInternal([]);
    setServerPricing({ itemTotal: 0, discount: 0, deliveryFee: 0, handlingCharge: 0, tax: 0, total: 0 });

    try {
      await cartService.clearCart();
    } catch (err) {
      logger.warn('clearCart API failed; local cart stays empty', err);
    } finally {
      endMutation();
    }
  }, [beginMutation, endMutation]);

  const value: CartContextType = {
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
    refreshCart,
    refreshCartWithPricingContext,
    flushAndRefreshCart,
    loading,
    syncing,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
