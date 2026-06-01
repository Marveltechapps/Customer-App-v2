import { api } from '../api/client';
import { endpoints } from '../api/endpoints';

export type BannerLeafContentItem = {
  _id?: string;
  type: 'banner' | 'video' | 'image' | 'text' | 'products';
  order?: number;
  imageUrl?: string;
  videoUrl?: string;
  text?: string;
  productIds?: string[];
  link?: string;
  isNavigable?: boolean;
  products?: Array<{
    _id: string;
    name?: string;
    price?: number;
    imageUrl?: string;
    images?: string[];
  }>;
};

export interface BannerContentItem extends BannerLeafContentItem {
  blockTitle?: string;
  nestedContentItems?: BannerLeafContentItem[];
}

export interface BannerDetailResponse {
  success: boolean;
  data?: {
    _id: string;
    title?: string;
    imageUrl?: string;
    contentItems?: BannerContentItem[];
  };
}

export const bannerService = {
  getById: async (id: string): Promise<BannerDetailResponse> => {
    const res = await api.get(endpoints.banner(id));
    return res as BannerDetailResponse;
  },
};

export default bannerService;
