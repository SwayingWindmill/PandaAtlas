"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface MapVisualizationErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  resetKey: number;
}

interface MapVisualizationErrorBoundaryState {
  failed: boolean;
}

export class MapVisualizationErrorBoundary extends Component<
  MapVisualizationErrorBoundaryProps,
  MapVisualizationErrorBoundaryState
> {
  state: MapVisualizationErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): MapVisualizationErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Map visualization failed", error, info.componentStack);
  }

  componentDidUpdate(previousProps: MapVisualizationErrorBoundaryProps): void {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render(): ReactNode {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}
