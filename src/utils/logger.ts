/**
 * Logger Utility
 * Centralized logging with environment-aware levels
 */

import { getEnvConfigSafe } from '../config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private shouldLog(): boolean {
    try {
      return getEnvConfigSafe().enableLogging || __DEV__;
    } catch (error) {
      // Default to logging in dev mode if config fails
      return __DEV__;
    }
  }

  private safeStringify(data: unknown): string {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (data) {
      return `${prefix} ${message}\nData: ${this.safeStringify(data)}`;
    }
    
    return `${prefix} ${message}`;
  }

  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog()) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, data);

    switch (level) {
      case 'debug':
        console.log(formattedMessage);
        break;
      case 'info':
        console.info(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
        console.error(formattedMessage);
        break;
    }

    // In production, you might want to send logs to a service
    try {
      if (getEnvConfigSafe().enableAnalytics && level === 'error') {
        // Send to error tracking service (e.g., Sentry)
        // This will be implemented when monitoring is set up
      }
    } catch (error) {
      // Silently fail if config is unavailable
    }
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error | any, data?: any): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorData = error instanceof Error ? { stack: error.stack, ...data } : { error, ...data };
    this.log('error', message || errorMessage, errorData);
  }
}

export const logger = new Logger();
export default logger;

