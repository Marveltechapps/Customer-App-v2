/**
 * Onboarding Service
 * Handles onboarding-related API calls
 */

import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { ApiResponse } from '../api/types';

export interface OnboardingPage {
  _id?: string;
  pageNumber: number;
  title: string;
  description: string;
  imageUrl: string;
  ctaText?: string;
  isActive?: boolean;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface OnboardingStatus {
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
}

/**
 * Get all active onboarding pages
 */
export const getOnboardingPages = async (): Promise<ApiResponse<OnboardingPage[]>> => {
  return api.get<OnboardingPage[]>(endpoints.onboarding.pages);
};

/**
 * Get a specific onboarding page by page number
 */
export const getOnboardingPageByNumber = async (pageNumber: number): Promise<ApiResponse<OnboardingPage>> => {
  return api.get<OnboardingPage>(endpoints.onboarding.pageByNumber(pageNumber));
};

/**
 * Mark onboarding as completed for the current user
 * Requires authentication
 */
export const completeOnboarding = async (): Promise<ApiResponse<OnboardingStatus>> => {
  return api.post<OnboardingStatus>(endpoints.onboarding.complete);
};

/**
 * Get onboarding completion status for the current user
 * Requires authentication
 */
export const getOnboardingStatus = async (): Promise<ApiResponse<OnboardingStatus>> => {
  return api.get<OnboardingStatus>(endpoints.onboarding.status);
};

