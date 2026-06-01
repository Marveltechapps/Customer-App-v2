import { apiClient } from '../api/client';

export type AdminCmsOverview = {
  success: boolean;
  counts: { skus: number; pages: number; banners: number; collections: number };
  issues?: Record<string, number>;
};

export type AdminCmsUploadResult = {
  success: boolean;
  counts: Record<string, number>;
  errors: Array<{ sheet?: string; row?: number; message: string }>;
};

export type CmsPage = {
  _id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published';
  blocks?: any[];
  updatedAt?: string;
  createdAt?: string;
};

export type CmsCollection = {
  _id: string;
  name: string;
  slug: string;
  type: 'manual' | 'rule-based';
  isActive?: boolean;
};

export type HomeBanner = {
  _id: string;
  slot: 'hero' | 'mid' | 'category';
  title?: string;
  imageUrl: string;
  redirectType?: string | null;
  redirectValue?: string;
  startDate?: string;
  endDate?: string;
  order?: number;
  isActive?: boolean;
};

export type HomeConfig = {
  heroVideoUrl?: string;
  searchPlaceholder?: string;
  deliveryTypeLabel?: string;
  categorySectionTitle?: string;
  organicTagline?: string;
  organicIconUrl?: string;
  sectionOrder?: string[];
  sectionVisibility?: Record<string, boolean>;
};

function buildFormData(file: { uri: string; name: string; type?: string }) {
  const formData = new FormData();
  formData.append('file', {
    // @ts-expect-error - React Native FormData file shape
    uri: file.uri,
    // @ts-expect-error - React Native FormData file shape
    type:
      file.type ||
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // @ts-expect-error - React Native FormData file shape
    name: file.name,
  });
  return formData;
}

export async function getCmsOverview(): Promise<AdminCmsOverview> {
  const res = await apiClient.get('/admin/cms/overview');
  return res.data as AdminCmsOverview;
}

export async function uploadSkuMaster(
  file: { uri: string; name: string; type?: string },
  overwrite: boolean
): Promise<AdminCmsUploadResult> {
  const formData = buildFormData(file);
  formData.append('overwrite', String(overwrite));
  const res = await apiClient.post('/admin/cms/upload/sku-master', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
  });
  return res.data as AdminCmsUploadResult;
}

export async function uploadCmsPages(
  file: { uri: string; name: string; type?: string }
): Promise<AdminCmsUploadResult> {
  const formData = buildFormData(file);
  const res = await apiClient.post('/admin/cms/upload/cms-pages', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
  });
  return res.data as AdminCmsUploadResult;
}

export async function listPages(): Promise<CmsPage[]> {
  const res = await apiClient.get('/admin/cms/pages');
  return (res.data as CmsPage[]) || [];
}

export async function getPage(id: string): Promise<CmsPage> {
  const res = await apiClient.get(`/admin/cms/pages/${id}`);
  return res.data as CmsPage;
}

export async function createPage(body: {
  slug: string;
  title?: string;
  status?: 'draft' | 'published';
  blocks?: any[];
}): Promise<CmsPage> {
  const res = await apiClient.post('/admin/cms/pages', body);
  return res.data as CmsPage;
}

export async function updatePage(
  id: string,
  body: Partial<CmsPage>
): Promise<CmsPage> {
  const res = await apiClient.put(`/admin/cms/pages/${id}`, body);
  return res.data as CmsPage;
}

export async function deletePage(id: string): Promise<void> {
  await apiClient.delete(`/admin/cms/pages/${id}`);
}

export async function listCollections(): Promise<CmsCollection[]> {
  const res = await apiClient.get('/admin/cms/collections');
  return (res.data as CmsCollection[]) || [];
}

export async function createCollection(body: Partial<CmsCollection>): Promise<CmsCollection> {
  const res = await apiClient.post('/admin/cms/collections', body);
  return res.data as CmsCollection;
}

export async function updateCollection(id: string, body: Partial<CmsCollection>): Promise<CmsCollection> {
  const res = await apiClient.put(`/admin/cms/collections/${id}`, body);
  return res.data as CmsCollection;
}

export async function deleteCollection(id: string): Promise<void> {
  await apiClient.delete(`/admin/cms/collections/${id}`);
}

// Home admin (banners + config) lives under /admin/home
export async function listBanners(): Promise<HomeBanner[]> {
  const res = await apiClient.get('/admin/home/banners');
  const payload = res.data as { success: boolean; data: HomeBanner[] };
  return Array.isArray(payload?.data) ? payload.data : [];
}

export async function createBanner(body: Partial<HomeBanner>): Promise<HomeBanner> {
  const res = await apiClient.post('/admin/home/banners', body);
  const payload = res.data as { success: boolean; data: HomeBanner };
  return payload.data;
}

export async function updateBanner(id: string, body: Partial<HomeBanner>): Promise<HomeBanner> {
  const res = await apiClient.put(`/admin/home/banners/${id}`, body);
  const payload = res.data as { success: boolean; data: HomeBanner };
  return payload.data;
}

export async function deleteBanner(id: string): Promise<void> {
  await apiClient.delete(`/admin/home/banners/${id}`);
}

export async function getHomeConfig(): Promise<HomeConfig> {
  const res = await apiClient.get('/admin/home/config');
  const payload = res.data as { success: boolean; data: HomeConfig };
  return payload.data || {};
}

export async function saveHomeConfig(body: HomeConfig): Promise<HomeConfig> {
  const res = await apiClient.post('/admin/home/config', body);
  const payload = res.data as { success: boolean; data: HomeConfig };
  return payload.data || {};
}

