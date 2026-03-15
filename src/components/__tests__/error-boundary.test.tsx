import { render, screen } from "@testing-library/react";
import ErrorBoundary from "@/components/error-boundary";

function ThrowingChild() {
  throw new Error("Test error");
}

describe("ErrorBoundary", () => {
  // Suppress console.error for expected errors
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div>OK</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("OK")).toBeInTheDocument();
  });

  it("renders default fallback on error", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
  });

  it("renders custom fallback on error", () => {
    render(
      <ErrorBoundary fallback={<div>Custom error</div>}>
        <ThrowingChild />
      </ErrorBoundary>
    );
    expect(screen.getByText("Custom error")).toBeInTheDocument();
  });
});
