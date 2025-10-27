import React, { Component, ReactNode } from 'react';
import { AppError, ErrorBoundaryState } from '../../types';

interface ComponentErrorBoundaryProps {
  children: ReactNode;
  componentName: string;
  fallbackComponent?: ReactNode;
  onError?: (error: AppError) => void;
  isolateError?: boolean; // If true, only shows minimal fallback to maintain app functionality
}

export class ComponentErrorBoundary extends Component<ComponentErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ComponentErrorBoundaryProps) {
    super(props);
    (this as any).state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const appError: AppError = {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'Component failed to render',
      details: error.stack,
      recoverable: true,
      timestamp: new Date(),
      severity: 'low',
      context: 'Component Error'
    };

    return {
      hasError: true,
      error: appError
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const appError: AppError = {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'Component failed to render',
      details: { error: error.stack, errorInfo },
      recoverable: true,
      timestamp: new Date(),
      severity: 'low',
      context: `${(this as any).props.componentName} Component`
    };

    (this as any).setState({
      hasError: true,
      error: appError,
      errorInfo
    });

    if ((this as any).props.onError) {
      (this as any).props.onError(appError);
    }

    // Privacy-safe logging
    console.warn(`ComponentErrorBoundary (${(this as any).props.componentName}):`, {
      message: error.message,
      component: (this as any).props.componentName,
      timestamp: new Date().toISOString()
    });
  }

  retry = () => {
    (this as any).setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    const state = (this as any).state;
    const props = (this as any).props;
    
    if (state.hasError && state.error) {
      // If we want to isolate the error and maintain app functionality
      if (props.isolateError) {
        return (
          <div className="p-2 bg-gray-100 border border-gray-300 rounded text-sm text-gray-600">
            Component temporarily unavailable
          </div>
        );
      }

      // Use custom fallback if provided
      if (props.fallbackComponent) {
        return props.fallbackComponent;
      }

      // Default fallback
      return (
        <ComponentErrorFallback
          error={state.error}
          componentName={props.componentName}
          retry={this.retry}
        />
      );
    }

    return props.children;
  }
}

interface ComponentErrorFallbackProps {
  error: AppError;
  componentName: string;
  retry: () => void;
}

const ComponentErrorFallback: React.FC<ComponentErrorFallbackProps> = ({
  error,
  componentName,
  retry
}) => {
  return (
    <div className="p-3 border border-yellow-300 bg-yellow-50 rounded">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <span className="text-yellow-600 mr-2">⚠️</span>
          <span className="text-sm font-medium text-yellow-800">
            {componentName} Error
          </span>
        </div>
        <button
          onClick={retry}
          className="text-xs px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
        >
          Retry
        </button>
      </div>
      
      <p className="text-xs text-yellow-700">
        {error.message}
      </p>
    </div>
  );
};