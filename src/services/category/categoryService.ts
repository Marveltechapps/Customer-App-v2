import { api } from '../api/client';
import { endpoints } from '../api/endpoints';

export interface CategoryPayloadCategory {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}

export interface CategoryPayloadSubCategory {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  thumbnailUrl?: string | null;
  cardImageUrl?: string | null;
}

export interface CategoryPayloadBanner {
  id: string;
  imageUrl: string;
  link: string | null;
  redirectType?: string | null;
  redirectValue?: string | null;
  title: string | null;
}

export interface CategoryPayloadProductVariant {
  id: string;
  productId?: string;
  size: string;
  price: number;
  originalPrice?: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  cardImageUrl?: string;
  images?: string[];
}

export interface CategoryPayloadProduct {
  id: string;
  name: string;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  cardImageUrl?: string | null;
  images: string[];
  price: number;
  originalPrice?: number;
  discount?: string;
  quantity: string;
  variants: CategoryPayloadProductVariant[];
}

export interface CategoryPayloadData {
  category: CategoryPayloadCategory;
  subcategories: CategoryPayloadSubCategory[];
  banners: CategoryPayloadBanner[];
  products: CategoryPayloadProduct[];
}

export interface CategoryPayloadResponse {
  success: boolean;
  data: CategoryPayloadData;
}

export const categoryService = {
  getCategoryPayload: async (
    categoryId: string,
    subCategoryId?: string | null
  ): Promise<CategoryPayloadResponse> => {
    const url = endpoints.categories.detail(categoryId);
    const params = subCategoryId ? { subCategoryId } : undefined;
    return api.get<CategoryPayloadData>(url, { params }) as Promise<CategoryPayloadResponse>;
  },

  /**
   * Fallback endpoint used when subcategory-specific `/categories/:id?subCategoryId=...` fails.
   * Backend supports: GET /categories/:slug/products?subcategory=<subSlug>
   */
  getCategoryProductsBySlug: async (categorySlug: string, subcategorySlug: string) => {
    const url = `/categories/${encodeURIComponent(categorySlug)}/products`;
    const params = {
      subcategory: subcategorySlug,
      sort: 'sortOrder',
      page: 1,
      limit: 50,
    };
    const res = await api.get<any>(url, { params });
    return res?.data ?? res;
  },
};

export default categoryService;
