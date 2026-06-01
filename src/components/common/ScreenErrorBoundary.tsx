/**
 * Screen Error Boundary
 * Specialized error boundary for individual screens with navigation support
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useNavigation } from '@react-navigation/native';
import ErrorBoundary from './ErrorBoundary';
import ScreenErrorFallback from './ScreenErrorFallback';

interface ScreenErrorBoundaryProps {
  children: ReactNode;
  screenName?: string;
}

const ScreenErrorBoundaryWithNav: React.FC<ScreenErrorBoundaryProps> = ({
  children,
  screenName,
}) => {
  const navigation = useNavigation();

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <ErrorBoundary
      fallback={
        <ScreenErrorFallback
      onRetry={() => {
        // Reset error boundary - navigation will handle re-render
        // In React Native, we rely on component remount
      }}
          onGoBack={handleGoBack}
        />
      }
      onError={(error, errorInfo) => {
        // Log screen-specific errors
        console.error(`Error in screen: ${screenName || 'Unknown'}`, error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
};

// HOC wrapper for screens that don't have navigation context
class ScreenErrorBoundaryClass extends Component<
  ScreenErrorBoundaryProps,
  { hasError: boolean; error: Error | null }
> {
  constructor(props: ScreenErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Error in screen: ${this.props.screenName || 'Unknown'}`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ScreenErrorFallback
          error={this.state.error}
          onRetry={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

export default ScreenErrorBoundaryWithNav;
export { ScreenErrorBoundaryClass };

