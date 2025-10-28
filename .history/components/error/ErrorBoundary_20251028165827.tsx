import React, { Component, ReactNode } from 'react';
import { AppError, ErrorBoundaryState } from '../../types';
import { errorLogger } from '../../lib/utils/errorLogger';
import { ErrorFeedback } from './ErrorFeedback';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: AppError, retry: () => void) => ReactNode;
  onError?: (error: AppError, errorInfo: any) => void;
  context?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const appError: AppError = {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unexpected error occurred',
      details: error.stack,
      recoverable: true,
      timestamp: new Date(),
      severity: 'medium',
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
      message: error.message || 'An unexpected error occurred',
      details: { error: error.stack, errorInfo },
      recoverable: true,
      timestamp: new Date(),
      severity: 'medium',
      context: this.props.context || 'Component Error'
    };

    this.setState({
      hasError: true,
      error: appError,
      errorInfo
    });

    if (this.props.onError) {
      this.props.onError(appError, errorInfo);
    }

    console.error('ErrorBoundary caught an error:', {
      message: error.message,
      context: this.props.context,
      timestamp: new Date().toISOString()
    });
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.retry);
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          retry={this.retry}
          context={this.props.context}
        />
      );
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: AppError;
  retry: () => void;
  context?: string;
}

const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({ error, retry, context }) => {
  const [showFeedback, setShowFeedback] = React.useState(false);
  const [errorId, setErrorId] = React.useState<string>('');

  React.useEffect(() => {
    const id = errorLogger.logError(error);
    setErrorId(id);
  }, [error]);

  const getErrorIcon = (severity?: string) => {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      default: return 'ℹ️';
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'high': return 'border-orange-500 bg-orange-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      default: return 'border-blue-500 bg-blue-50';
    }
  };

  return (
    <div className={`p-6 border-2 rounded-lg ${getSeverityColor(error.severity)} max-w-md mx-auto mt-8`}>
      <div className="flex items-center mb-4">
        <span className="text-2xl mr-3">{getErrorIcon(error.severity)}</span>
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Something went wrong</h3>
          {context && <p className="text-sm text-gray-600">in {context}</p>}
        </div>
      </div>

      <p className="text-gray-700 mb-4">{error.message}</p>

      <div className="flex gap-3">
        {error.recoverable && (
          <button
            onClick={retry}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        )}
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
        >
          Reload Page
        </button>
      </div>

      <div className="mt-4">
        {!showFeedback ? (
          <button
            onClick={() => setShowFeedback(true)}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Report this error
          </button>
        ) : (
          <ErrorFeedback
            errorId={errorId}
            onClose={() => setShowFeedback(false)}
          />
        )}
      </div>

      {process.env.NODE_ENV === 'development' && error.details && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-gray-600">Technical Details</summary>
          <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
            {typeof error.details === 'string' ? error.details : JSON.stringify(error.details, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
};