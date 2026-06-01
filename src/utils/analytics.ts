/**
 * Analytics Utility
 * Wrapper for analytics tracking
 */

import { getEnvConfigSafe } from '../config/env';
import { logger } from './logger';

type AnalyticsEvent = {
  name: string;
  properties?: Record<string, any>;
};

class Analytics {
  private enabled: boolean;

  constructor() {
    try {
      this.enabled = getEnvConfigSafe().enableAnalytics;
    } catch (error) {
      logger.warn('Error getting analytics config, defaulting to enabled', error);
      this.enabled = true;
    }
  }

  /**
   * Track an event
   */
  track(event: AnalyticsEvent): void {
    if (!this.enabled) {
      return;
    }

    // Log event in development
    if (__DEV__) {
      logger.debug('Analytics Event', event);
    }

    // In production, send to analytics service
    // Example: Firebase Analytics, Mixpanel, etc.
    // firebase.analytics().logEvent(event.name, event.properties);
  }

  /**
   * Track screen view
   */
  trackScreenView(screenName: string, properties?: Record<string, any>): void {
    this.track({
      name: 'screen_view',
      properties: {
        screen_name: screenName,
        ...properties,
      },
    });
  }

  /**
   * Track user action
   */
  trackAction(action: string, properties?: Record<string, any>): void {
    this.track({
      name: 'user_action',
      properties: {
        action,
        ...properties,
      },
    });
  }

  /**
   * Set user properties
   */
  setUserProperties(properties: Record<string, any>): void {
    if (!this.enabled) {
      return;
    }

    // Set user properties in analytics service
    // Example: firebase.analytics().setUserProperties(properties);
  }

  /**
   * Set user ID
   */
  setUserId(userId: string): void {
    if (!this.enabled) {
      return;
    }

    // Set user ID in analytics service
    // Example: firebase.analytics().setUserId(userId);
  }
}

export const analytics = new Analytics();
export default analytics;

