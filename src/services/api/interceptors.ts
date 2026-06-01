/**
 * API Interceptors
 * Request and response interceptors for axios
 */

import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiError } from './types';
import { tokenManager } from './tokenManager';
import { getEnvConfigSafe, DEFAULT_BACKEND_PORT } from '../../config/env';
import { resetToLogin } from '../../utils/navigationRef';

/**
 * Request interceptor - Set base URL, ensure tokens loaded, add auth header
 */
export const requestInterceptor = async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
  // Use current apiBaseUrl so we always hit the right backend (e.g. after env load)
  try {
    config.baseURL = getEnvConfigSafe().apiBaseUrl;
  } catch {
    // keep existing baseURL if config fails
  }

  // Skip auth for login/OTP endpoints
  if ((config as any).skipAuth) {
    if (config.headers) {
      config.headers['Content-Type'] = config.headers['Content-Type'] || 'application/json';
    }
    return config;
  }

  // Ensure tokens are loaded from storage before first request
  await tokenManager.initialize();
  const token = tokenManager.getToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.headers) {
    config.headers['Content-Type'] = config.headers['Content-Type'] || 'application/json';
  }

  try {
    // @ts-ignore __DEV__ may be global in RN/Expo
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.debug('[api][request]', {
        method: config.method,
        baseURL: config.baseURL,
        url: config.url,
        fullUrl: `${config.baseURL || ''}${config.url || ''}`,
        data: config.data,
        headers: config.headers,
      });
    }
  } catch (e) {
    // ignore logging errors
  }

  return config;
};

/**
 * Response interceptor - Handle responses and errors
 */
export const responseInterceptor = {
  onFulfilled: (response: AxiosResponse) => {
    try {
      // @ts-ignore __DEV__
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // eslint-disable-next-line no-console
        console.debug('[api][response]', {
          status: response.status,
          url: response.config && `${response.config.baseURL || ''}${response.config.url || ''}`,
          data: response.data,
          headers: response.headers,
        });
      }
    } catch (e) {
      // ignore
    }
    // Return the full axios response to let higher-level wrappers handle .data consistently
    return response;
  },
  onRejected: async (error: AxiosError<ApiError>) => {
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 401:
          // Only clear and redirect when we had a token that was rejected (expired/invalid)
          if (tokenManager.isAuthenticated()) {
            await tokenManager.clearTokens();
            resetToLogin();
          }
          break;
        case 403:
          break;
        case 404:
          break;
        case 500:
          break;
        default:
          break;
      }

      let message =
        (typeof data === 'object' && data !== null && typeof data.message === 'string' && data.message) ||
        error.message ||
        'An error occurred';

      if (status === 502) {
        const baseURL = String(error.config?.baseURL || '');
        const isHosted = baseURL.includes('api.selorg.com');
        message = isHosted
          ? 'Server is temporarily unavailable. Please try again in a few minutes.'
          : `Cannot reach the API server (502). Start the backend on port ${DEFAULT_BACKEND_PORT}, then reload the app.`;
      } else if (status === 503) {
        message =
          (typeof data === 'object' && data !== null && typeof data.message === 'string' && data.message) ||
          'Service temporarily unavailable. Please try again.';
      }

      const apiError: ApiError = {
        message,
        code: data?.code,
        status,
        errors: data?.errors,
      };

      return Promise.reject(apiError);
    }

    // Network error - do NOT clear tokens; user may be offline temporarily
    let message = error.message || 'Network error. Please check your connection.';
    // @ts-ignore __DEV__
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      const baseURL = String(error.config?.baseURL || getEnvConfigSafe().apiBaseUrl);
      const isNetworkFailure =
        error.code === 'ECONNREFUSED' ||
        error.code === 'ERR_NETWORK' ||
        /network error/i.test(message);
      if (isNetworkFailure) {
        message =
          `Cannot reach the backend at ${baseURL}. ` +
          `Start selorg-backend on port ${DEFAULT_BACKEND_PORT} (npm run dev). ` +
          'If the terminal shows "Port already in use", a backend is already running — reload Expo Go instead of starting another instance.';
      }
    }

    const apiError: ApiError = {
      message,
      code: 'NETWORK_ERROR',
    };

    return Promise.reject(apiError);
  },
};

