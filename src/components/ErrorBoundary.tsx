import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { log } from '@/lib/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    log.error('ErrorBoundary', error.message, { componentStack: info.componentStack });
    this.props.onError?.(error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <span className="text-2xl">⚠</span>
            <p className="text-sm text-muted-foreground">Something went wrong</p>
            <button
              className="text-xs text-primary underline underline-offset-2"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="mt-2 max-w-md truncate rounded bg-muted p-2 text-xs text-muted-foreground">
                {this.state.error.message}
              </pre>
            )}
          </div>
        )
      );
    }
    return this.props.children;
  }
}
