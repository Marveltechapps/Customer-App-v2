/**
 * Screen Error Fallback Component
 * Specialized error UI for screen-level errors
 */

import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenErrorFallbackProps {
  error?: Error | null;
  onRetry?: () => void;
  onGoBack?: () => void;
}

const ScreenErrorFallback: React.FC<ScreenErrorFallbackProps> = ({
  error,
  onRetry,
  onGoBack,
}) => {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Error Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.errorIcon}>
            <Text style={styles.errorIconText}>⚠️</Text>
          </View>
        </View>

        {/* Error Message */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>Oops! Something went wrong</Text>
          <Text style={styles.message}>
            {error?.message || 'We encountered an unexpected error. Please try again.'}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          {onRetry && (
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={onRetry}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}
          {onGoBack && (
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={onGoBack}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>Go Back</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  iconContainer: {
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFE5E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIconText: {
    fontSize: 40,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 32,
    maxWidth: 300,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  message: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Inter',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#034703',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#034703',
  },
  secondaryButtonText: {
    color: '#034703',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});

export default ScreenErrorFallback;

