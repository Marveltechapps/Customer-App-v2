import { api } from '../api/client';
import { endpoints } from '../api/endpoints';

export interface PageBlock {
  id: string;
  type: string;
  config: Record<string, unknown>;
  data: Record<string, unknown>;
}

export interface PagePayload {
  pageId: string;
  slug: string;
  title: string;
  version: number;
  blocks: PageBlock[];
}

export interface BootstrapData {
  pages: { home: PagePayload | null };
  appConfig?: import('../../contexts/AppConfigContext').AppConfigData;
  legacy?: {
    config: Record<string, unknown>;
    categories: unknown[];
    heroBanners: unknown[];
    midBanners: unknown[];
    sections: Record<string, { title?: string; products?: unknown[] }>;
    lifestyle: unknown[];
    promoBlocks: Record<string, { imageUrl?: string; link?: string }>;
    defaultAddress: unknown;
  };
  featureFlags: Record<string, unknown>;
  flowConfig: Record<string, unknown>;
  activePromotions: unknown[];
  defaultAddress: unknown;
}

export interface BootstrapResponse {
  success: boolean;
  data: BootstrapData;
}

export const bootstrapService = {
  getBootstrap: async (): Promise<BootstrapResponse> => {
    return api.get(endpoints.bootstrap);
  },

  getPage: async (slug: string) => {
    return api.get(endpoints.page(slug));
  },
};
