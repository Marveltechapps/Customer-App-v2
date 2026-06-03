import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { ApiResponse } from '../api/types';

export interface Coupon {
  _id: string;
  code: string;
  displayName: string;
  description?: string;
  couponType: 'FLAT_DISCOUNT' | 'PERCENTAGE' | 'FREE_DELIVERY' | 'BOGO' | 'CASHBACK' | 'TIERED_FLAT';
  discountValue: number;
  minOrderValue: number;
  maxDiscountCap?: number;
  usageLimit?: number | null;
  usageCount?: number;
  usagePerUser?: number;
  discountType?: string;
  startDate?: string;
  endDate?: string;
  validDays?: string[];
  validTimeSlots?: Array<{ from: string; to: string }>;
  termsAndConditions?: string;
  bannerImageUrl?: string;
  themeColor?: string;
  showInSections?: string[];
  priorityRank?: number;
  isCashback?: boolean;
  cashbackValue?: number;
}

export interface ValidateCouponRequest {
  coupon_code: string;
  user_id?: string;
  cart_items: any[];
  cart_value: number;
  payment_method: string;
  zone?: string;
  delivery_fee: number;
}

export interface ValidateCouponResponse {
  valid: boolean;
  error_code?: string;
  discount_amount?: number;
  coupon_type?: string;
  display_name?: string;
  is_cashback?: boolean;
  cashback_value?: number;
  min_required?: number;
  allowed?: string;
}

export interface RedeemCouponRequest extends ValidateCouponRequest {
  order_id: string;
}

export interface RedeemCouponResponse {
  success: boolean;
  discount_applied?: number;
  error?: string;
}

export const couponService = {
  /**
   * List eligible coupons for the current user/cart
   */
  listCoupons: async (params?: {
    user_id?: string;
    cart_value?: number;
    zone?: string;
    payment_method?: string;
    userId?: string;
    cartValue?: number;
    paymentMethod?: string;
  }): Promise<ApiResponse<{ coupons: Coupon[] }>> => {
    return api.get<{ coupons: Coupon[] }>(endpoints.coupons.list, { params });
  },

  /**
   * Validate a coupon code against the current cart
   */
  validateCoupon: async (data: ValidateCouponRequest): Promise<ApiResponse<ValidateCouponResponse>> => {
    return api.post<ValidateCouponResponse>(endpoints.coupons.validate, data);
  },

  /**
   * Redeem a coupon (called after order confirmation)
   */
  redeemCoupon: async (data: RedeemCouponRequest): Promise<ApiResponse<RedeemCouponResponse>> => {
    return api.post<RedeemCouponResponse>(endpoints.coupons.redeem, data);
  },
};
