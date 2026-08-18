import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportBrowserServiceError } from "../../../lib/errorTelemetry";

export class SetupPresentationErrorBoundary extends Component<{
  artistWorkspaceId: string;
  fallback: ReactNode;
  children: ReactNode;
}, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportBrowserServiceError(error, {
      operation: "setup_presentation_render",
      artist_workspace_id: this.props.artistWorkspaceId,
      presentation_version: 2,
      component_stack: info.componentStack?.slice(0, 2_000),
    });
  }

  componentDidUpdate(previous: Readonly<{ artistWorkspaceId: string }>) {
    if (this.state.failed && previous.artistWorkspaceId !== this.props.artistWorkspaceId) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
