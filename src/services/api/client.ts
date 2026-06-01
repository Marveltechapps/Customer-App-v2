/**
 * API Client
 * Axios instance with interceptors and configuration
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { requestInterceptor, responseInterceptor } from './interceptors';
import type { ApiResponse, RequestConfig } from './types';

import { getEnvConfigSafe, DEFAULT_DEV_API_BASE_URL } from '../../config/env';
import { tokenManager } from './tokenManager';
import { logger } from '@/utils/logger';

// Base URL from environment config (unified backend: /api/v1/customer, port must match backend PORT)
const getBaseURL = (): string => {
  try {
    return getEnvConfigSafe().apiBaseUrl;
  } catch (error) {
    logger.error('Error getting base URL, using default', error);
    return DEFAULT_DEV_API_BASE_URL;
  }
};

/**
 * Create configured axios instance
 */
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: getBaseURL(),
    timeout: 30000, // 30 seconds
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  // Initialize token manager on app start
  tokenManager.initialize();

  // Add request interceptor
  client.interceptors.request.use(
    (config) => requestInterceptor(config),
    (error) => Promise.reject(error)
  );

  // Add response interceptor
  client.interceptors.response.use(
    responseInterceptor.onFulfilled,
    responseInterceptor.onRejected
  );

  return client;
};

// Export singleton instance
export const apiClient = createApiClient();

/**
 * API Client methods
 */
export const api = {
  /**
   * GET request
   */
  get: async <T = any>(
    url: string,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> => {
    const response = await apiClient.get<ApiResponse<T>>(url, config as AxiosRequestConfig);
    return response.data as ApiResponse<T>;
  },

  /**
   * POST request
   */
  post: async <T = any>(
    url: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> => {
    const response = await apiClient.post<ApiResponse<T>>(url, data, config as AxiosRequestConfig);
    return response.data as ApiResponse<T>;
  },

  /**
   * PUT request
   */
  put: async <T = any>(
    url: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> => {
    const response = await apiClient.put<ApiResponse<T>>(url, data, config as AxiosRequestConfig);
    return response.data as ApiResponse<T>;
  },

  /**
   * PATCH request
   */
  patch: async <T = any>(
    url: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> => {
    const response = await apiClient.patch<ApiResponse<T>>(url, data, config as AxiosRequestConfig);
    return response.data as ApiResponse<T>;
  },

  /**
   * DELETE request
   */
  delete: async <T = any>(
    url: string,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> => {
    const response = await apiClient.delete<ApiResponse<T>>(url, config as AxiosRequestConfig);
    return response.data as ApiResponse<T>;
  },
};

// Default export the low-level axios instance to avoid a duplicate `api` identifier
export default apiClient;

