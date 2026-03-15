import { renderHook } from "@testing-library/react";
import { useIsMobile } from "@/hooks/use-is-mobile";

describe("useIsMobile", () => {
  it("returns false when viewport is wide", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("returns true when viewport is narrow", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });
});
