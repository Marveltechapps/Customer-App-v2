/**
 * Token Manager
 * Manages auth tokens in memory for synchronous access.
 * Tokens are persisted to storage on login and restored on app start.
 */

import * as storage from '../../utils/storage';
import { logger } from '@/utils/logger';

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

class TokenManager {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize token manager - load tokens from storage.
   * Safe to call multiple times; subsequent calls wait for the first to complete.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.accessToken = await storage.getToken();
        this.refreshToken = await storage.getRefreshToken();
        this.initialized = true;
      } catch (error) {
        logger.error('Error initializing token manager', error);
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Get access token (synchronous). Returns null if not initialized or no token.
   */
  getToken(): string | null {
    return this.accessToken;
  }

  /**
   * Get access token (async). Ensures initialize has run, then returns token or null.
   * Use when making manual fetch calls that need the token.
   */
  async getAccessToken(): Promise<string | null> {
    await this.initialize();
    return this.accessToken;
  }

  /**
   * Get refresh token (synchronous)
   */
  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  /**
   * Set tokens and persist to storage. Call after successful login.
   */
  async setTokens(accessToken: string, refreshToken?: string): Promise<void> {
    this.accessToken = accessToken;
    if (refreshToken) {
      this.refreshToken = refreshToken;
    }

    await storage.saveToken(accessToken);
    if (refreshToken) {
      await storage.saveRefreshToken(refreshToken);
    }
  }

  /**
   * Clear tokens from memory and storage. Call on logout or when token is rejected (401).
   */
  async clearTokens(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.initialized = false;
    this.initPromise = null;
    await storage.clearToken();
    await storage.clearUserData();
    await storage.clearInFlightPayment();
  }

  /**
   * Check if user has a token (may be expired)
   */
  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  /**
   * Check if the stored token exists and is not expired.
   * Decodes the JWT payload and compares `exp` against current time.
   */
  isTokenValid(): boolean {
    if (!this.accessToken) return false;
    const payload = decodeJwtPayload(this.accessToken);
    if (!payload || typeof payload.exp !== 'number') return false;
    const nowSeconds = Math.floor(Date.now() / 1000);
    return payload.exp > nowSeconds;
  }
}

export const tokenManager = new TokenManager();

