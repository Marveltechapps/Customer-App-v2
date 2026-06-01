/**
 * Global Error Handler
 * Centralized error handling and reporting
 */

import { logger } from './logger';
import type { ApiError } from '../services/api/types';

export interface AppError {
  message: string;
  code?: string;
  status?: number;
  originalError?: Error | any;
  context?: Record<string, any>;
}

/**
 * Handle API errors
 */
export const handleApiError = (error: ApiError | Error): AppError => {
  if ('status' in error && 'code' in error) {
    // It's an ApiError
    const apiError = error as ApiError;
    logger.error('API Error', apiError, { status: apiError.status, code: apiError.code });
    
    return {
      message: apiError.message || 'An error occurred',
      code: apiError.code,
      status: apiError.status,
      originalError: error,
    };
  }

  // It's a regular Error
  const regularError = error as Error;
  logger.error('Error', regularError);
  
  return {
    message: regularError.message || 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
    originalError: regularError,
  };
};

/**
 * Handle network errors
 */
export const handleNetworkError = (error: any): AppError => {
  logger.error('Network Error', error);
  
  return {
    message: 'Network error. Please check your internet connection.',
    code: 'NETWORK_ERROR',
    originalError: error,
  };
};

/**
 * Handle validation errors
 */
export const handleValidationError = (errors: Record<string, string[]>): AppError => {
  const firstError = Object.values(errors)[0]?.[0] || 'Validation failed';
  
  return {
    message: firstError,
    code: 'VALIDATION_ERROR',
    originalError: errors,
    context: { errors },
  };
};

/**
 * Format error message for user display
 */
export const getUserFriendlyMessage = (error: AppError): string => {
  // Return user-friendly messages based on error code
  switch (error.code) {
    case 'NETWORK_ERROR':
      return 'Unable to connect. Please check your internet connection.';
    case 'VALIDATION_ERROR':
      return error.message;
    case 'UNAUTHORIZED':
      return 'Please log in to continue.';
    case 'FORBIDDEN':
      return 'You do not have permission to perform this action.';
    case 'NOT_FOUND':
      return 'The requested resource was not found.';
    case 'SERVER_ERROR':
      return 'Server error. Please try again later.';
    default:
      return error.message || 'An unexpected error occurred. Please try again.';
  }
};

/**
 * Global error handler for unhandled errors
 */
export const setupGlobalErrorHandler = (): void => {
  // Handle unhandled promise rejections
  if (typeof global !== 'undefined') {
    const originalHandler = (global as any).ErrorUtils?.getGlobalHandler?.();
    
    (global as any).ErrorUtils?.setGlobalHandler?.((error: Error, isFatal?: boolean) => {
      logger.error('Unhandled Error', error, { isFatal });
      
      // Call original handler if it exists
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });
  }
};

