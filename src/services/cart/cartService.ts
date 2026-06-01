/**
 * Cart Service
 * Handles cart-related API calls
 */

import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { ApiResponse } from '../api/types';

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  variantSize: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  image: string;
}

export interface Cart {
  items: CartItem[];
  itemTotal: number;
  discount: number;
  deliveryFee: number;
  handlingCharge?: number;
  tax?: number;
  total: number;
  appliedCoupon?: {
    code: string;
    discount: number;
  };
}

export interface CartPricingContext {
  couponCode?: string;
  zone?: string;
  paymentMethod?: string;
}

export interface AddToCartRequest {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface UpdateCartItemRequest {
  quantity: number;
  /** Optional: lets backend resolve the line if cart line id is stale. */
  productId?: string;
  variantId?: string;
}

/**
 * Get cart
 */
export const getCart = async (context?: CartPricingContext): Promise<ApiResponse<Cart>> => {
  const params: Record<string, string> = {};
  if (context?.couponCode) params.coupon_code = context.couponCode;
  if (context?.zone) params.zone = context.zone;
  if (context?.paymentMethod) params.payment_method = context.paymentMethod;
  return api.get<Cart>(endpoints.cart.get, Object.keys(params).length ? { params } : undefined);
};

/**
 * Add item to cart
 */
export const addToCart = async (data: AddToCartRequest): Promise<ApiResponse<Cart>> => {
  return api.post<Cart>(endpoints.cart.addItem, data);
};

/**
 * Update cart item quantity
 */
export const updateCartItem = async (itemId: string, data: UpdateCartItemRequest): Promise<ApiResponse<Cart>> => {
  return api.put<Cart>(endpoints.cart.updateItem(itemId), data);
};

/**
 * Update quantity (or remove when quantity is 0) by product + variant — fullstack path when line-item id is missing.
 */
export const updateCartItemByProduct = async (data: {
  productId: string;
  variantId: string;
  quantity: number;
}): Promise<ApiResponse<Cart>> => {
  return api.put<Cart>(endpoints.cart.updateItemByProduct, data);
};

/**
 * Remove item from cart (optional productId/variantId helps backend if line id is wrong)
 */
export const removeFromCart = async (
  itemId: string,
  opts?: { productId?: string; variantId?: string }
): Promise<ApiResponse<Cart>> => {
  return api.delete<Cart>(endpoints.cart.removeItem(itemId), opts ? { data: opts } : undefined);
};

/**
 * Clear cart
 */
export const clearCart = async (): Promise<ApiResponse<void>> => {
  return api.delete<void>(endpoints.cart.clear);
};

