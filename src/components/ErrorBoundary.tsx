import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center p-8 border rounded-lg shadow-md max-w-md">
            <h1 className="text-2xl font-bold text-destructive mb-4">אופס, משהו השתבש</h1>
            <p className="text-muted-foreground mb-6">
              אנו מצטערים, אך האפליקציה נתקלה בשגיאה בלתי צפויה.
            </p>
            <Button onClick={() => window.location.reload()}>
              רענן את העמוד
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
