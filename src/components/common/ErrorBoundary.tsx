/**
 * Error Boundary Component
 * Catches React component errors and displays fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { logger } from '@/utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      componentStack: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const componentStack = errorInfo.componentStack ?? null;
    this.setState({ componentStack });

    // Always print to Metro / device logs so "View error log" content is recoverable
    console.error('[ErrorBoundary]', error?.message, '\n', error?.stack, '\n', componentStack);
    logger.error('ErrorBoundary caught an error', error, {
      componentStack,
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      componentStack: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        if (React.isValidElement(this.props.fallback)) {
          const fallbackOnRetry = (this.props.fallback.props as { onRetry?: () => void }).onRetry;
          return React.cloneElement(this.props.fallback, {
            error: this.state.error ?? undefined,
            onRetry: () => {
              fallbackOnRetry?.();
              this.handleReset();
            },
          } as { error?: Error | null; onRetry?: () => void });
        }
        return this.props.fallback;
      }

      const message = this.state.error?.message || 'An unexpected error occurred';
      const stack =
        [this.state.error?.stack, this.state.componentStack].filter(Boolean).join('\n\n') || null;

      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message} selectable>
            {message}
          </Text>
          {__DEV__ && stack ? (
            <ScrollView style={styles.logBox} contentContainerStyle={styles.logContent}>
              <Text style={styles.logLabel}>Error log (dev)</Text>
              <Text style={styles.logText} selectable>
                {stack}
              </Text>
            </ScrollView>
          ) : null}
          <TouchableOpacity onPress={this.handleReset} style={styles.button}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1A1A1A',
    fontFamily: 'Inter',
  },
  message: {
    fontSize: 16,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'Inter',
    lineHeight: 22,
  },
  logBox: {
    alignSelf: 'stretch',
    maxHeight: 280,
    marginBottom: 20,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
  },
  logContent: {
    padding: 12,
  },
  logLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9AE6B4',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  logText: {
    fontSize: 11,
    color: '#E2E8F0',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string,
    lineHeight: 16,
  },
  button: {
    backgroundColor: '#034703',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});

export default ErrorBoundary;

