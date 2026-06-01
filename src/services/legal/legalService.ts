/**
 * Legal Service
 * Terms of Service, Privacy Policy, and login legal config from backend
 */

import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { ApiResponse } from '../api/types';

export interface LoginLegalConfig {
  preamble: string;
  terms: { label: string; type: 'in_app' | 'url'; url: string | null };
  privacy: { label: string; type: 'in_app' | 'url'; url: string | null };
  connector: string;
}

export interface LegalConfigResponse {
  loginLegal: LoginLegalConfig;
}

export interface LegalDocumentData {
  id?: string;
  version: string;
  title: string;
  effectiveDate: string;
  lastUpdated: string;
  contentFormat: 'plain' | 'html' | 'markdown';
  content: string;
}

/**
 * Get login footer legal config (preamble, terms/privacy labels and link type/url)
 */
export const getLegalConfig = async (): Promise<ApiResponse<LegalConfigResponse>> => {
  return api.get<LegalConfigResponse>(endpoints.legal.config);
};

/**
 * Get current Terms of Service document
 */
export const getTerms = async (version?: string): Promise<ApiResponse<LegalDocumentData>> => {
  const url = version ? `${endpoints.legal.terms}?version=${encodeURIComponent(version)}` : endpoints.legal.terms;
  return api.get<LegalDocumentData>(url);
};

/**
 * Get current Privacy Policy document
 */
export const getPrivacy = async (version?: string): Promise<ApiResponse<LegalDocumentData>> => {
  const url = version ? `${endpoints.legal.privacy}?version=${encodeURIComponent(version)}` : endpoints.legal.privacy;
  return api.get<LegalDocumentData>(url);
};

/**
 * Record user acceptance of terms/privacy versions (requires auth)
 */
export const acceptLegal = async (body: {
  termsVersion?: string;
  privacyVersion?: string;
}): Promise<ApiResponse<{ acceptedTermsVersion?: string; acceptedPrivacyVersion?: string }>> => {
  return api.post(endpoints.legal.accept, body);
};
