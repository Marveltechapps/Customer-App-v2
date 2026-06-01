import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { ApiResponse, PaginatedResponse } from '../api/types';

export interface ProductVariant {
  id: string;
  size: string;
  price: number;
  originalPrice?: number;
  inStock?: boolean;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  discount?: string;
  image?: string;
  images?: string[];
  categoryId?: string;
  categoryName?: string;
  inStock?: boolean;
  variants?: ProductVariant[];
  gstRate?: number;
}

export interface Category {
  id: string;
  name: string;
  image?: string;
  description?: string;
  subCategories?: any[];
}

export interface ProductListParams {
  page?: number;
  limit?: number;
  categoryId?: string;
  search?: string;
  sortBy?: 'price' | 'name' | 'popularity';
  sortOrder?: 'asc' | 'desc';
  storeId?: string;
}

/**
 * Get list of products
 */
export const getProducts = async (params?: ProductListParams): Promise<ApiResponse<PaginatedResponse<Product>>> => {
  return api.get<PaginatedResponse<Product>>(endpoints.products.list, { params });
};

/**
 * Get product by ID
 */
export const getProductById = async (id: string): Promise<ApiResponse<Product>> => {
  return api.get<Product>(endpoints.products.detail(id));
};

/**
 * Get product detail (alias)
 */
export const getProductDetail = getProductById;

/** Backend returns `{ success, data: Product[], meta }` — not nested `data.data`. */
export function productsFromListResponse(resp: ApiResponse<unknown> | undefined): Product[] {
  const data = resp?.data;
  if (Array.isArray(data)) {
    return data as Product[];
  }
  if (data && typeof data === 'object' && Array.isArray((data as PaginatedResponse<Product>).data)) {
    return (data as PaginatedResponse<Product>).data;
  }
  return [];
}

/**
 * Search products (GET /products/search?q=…)
 */
export const searchProducts = async (
  query: string,
  params?: ProductListParams,
): Promise<ApiResponse<Product[]>> => {
  return api.get<Product[]>(endpoints.products.search, {
    params: { ...params, q: query },
  });
};

/**
 * Fast typeahead suggestions (GET /products/search/suggestions?q=…)
 */
export const searchProductSuggestions = async (query: string): Promise<ApiResponse<Product[]>> => {
  return api.get<Product[]>(`${endpoints.products.search}/suggestions`, {
    params: { q: query },
  });
};

/**
 * Get products by category
 */
export const getProductsByCategory = async (categoryId: string, params?: ProductListParams): Promise<ApiResponse<PaginatedResponse<Product>>> => {
  return api.get<PaginatedResponse<Product>>(endpoints.products.byCategory(categoryId), { params });
};

/**
 * Get list of categories
 */
export const getCategories = async (): Promise<ApiResponse<Category[]>> => {
  return api.get<Category[]>(endpoints.categories.list);
};

/**
 * Get category by ID
 */
export const getCategoryById = async (id: string): Promise<ApiResponse<Category>> => {
  return api.get<Category>(endpoints.categories.detail(id));
};
