import React from 'react';
import { AppError, ErrorBoundaryState, ErrorRecoveryAction } from '../../types';

interface ServiceErrorBoundaryProps {
  children: React.ReactNode;
  serviceName: string;
  onError?: (error: AppError) => void;
  recoveryActions?: ErrorRecoveryAction[];
}

interface ServiceErrorBoundaryState extends ErrorBoundaryState { }

class ServiceErrorBoundary extends React.Component<ServiceErrorBoundaryProps, ServiceErrorBoundaryState> {
  constructor(props: ServiceErrorBoundaryProps) {
    super(props);
    (this as any).state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ServiceErrorBoundaryState {
    const appError: AppError = {
      code: 'API_ERROR',
      message: error.message || 'Service operation failed',
      details: error.stack,
      recoverable: true,
      timestamp: new Date(),
      severity: 'high',
      context: 'Service Error'
    };

    return {
      hasError: true,
      error: appError
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const appError: AppError = {
      code: 'API_ERROR',
      message: error.message || 'Service operation failed',
      details: { error: error.stack, errorInfo },
      recoverable: true,
      timestamp: new Date(),
      severity: 'high',
      context: `${(this as any).props.serviceName} Service`
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
    console.error(`ServiceErrorBoundary (${(this as any).props.serviceName}):`, {
      message: error.message,
      service: (this as any).props.serviceName,
      timestamp: new Date().toISOString()
    });
  }

  retry = (): void => {
    (this as any).setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render(): React.ReactNode {
    const state = (this as any).state;
    const props = (this as any).props;

    if (state.hasError && state.error) {
      return (
        <ServiceErrorFallback
          error={state.error}
          serviceName={props.serviceName}
          retry={this.retry}
          recoveryActions={props.recoveryActions}
        />
      );
    }

    return props.children;
  }
}

interface ServiceErrorFallbackProps {
  error: AppError;
  serviceName: string;
  retry: () => void;
  recoveryActions?: ErrorRecoveryAction[];
}

const ServiceErrorFallback: React.FC<ServiceErrorFallbackProps> = ({
  error,
  serviceName,
  retry,
  recoveryActions
}) => {
  const getServiceIcon = (serviceName: string) => {
    switch (serviceName.toLowerCase()) {
      case 'llm':
      case 'ai':
        return '🤖';
      case 'file':
        return '📁';
      case 'export':
        return '📤';
      case 'database':
        return '💾';
      default:
        return '⚙️';
    }
  };

  return (
    <div className="p-4 border border-red-300 bg-red-50 rounded-lg">
      <div className="flex items-center mb-3">
        <span className="text-xl mr-2">{getServiceIcon(serviceName)}</span>
        <h4 className="text-lg font-medium text-red-800">
          {serviceName} Service Error
        </h4>
      </div>

      <p className="text-red-700 mb-4">{error.message}</p>

      <div className="flex flex-wrap gap-2">
        {error.recoverable && (
          <button
            onClick={retry}
            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
          >
            Retry Operation
          </button>
        )}

        {recoveryActions?.map((action, index) => (
          <button
            key={index}
            onClick={action.action}
            className={`px-3 py-1 text-sm rounded transition-colors ${action.primary
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
          >
            {action.label}
          </button>
        ))}
      </div>

      <div className="mt-3 text-xs text-red-600">
        Error occurred at {error.timestamp.toLocaleTimeString()}
      </div>
    </div>
  );
};

export { ServiceErrorBoundary };