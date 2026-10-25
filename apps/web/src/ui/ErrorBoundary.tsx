import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from './states';

interface Props {
  children: ReactNode;
  title: string;
  body: string;
  retry: string;
}

export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(err: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console -- surfaces render failures to the browser console for support
    console.error(err, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <ErrorState
        title={this.props.title}
        body={this.props.body}
        retryLabel={this.props.retry}
        onRetry={() => this.setState({ failed: false })}
      />
    );
  }
}
