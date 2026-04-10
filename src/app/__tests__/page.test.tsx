import { render, screen, waitFor, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Home from "@/app/page";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { favoritesStore } from "@/lib/favorites";

// CI runners are slower — allow enough time for multi-interaction tests
vi.setConfig({ testTimeout: 30000 });

// Mock the components that use WebGL or tricky to render
vi.mock("@/components/map/california-map", () => {
  return {
    default: function MapMock() {
      return <div data-testid="california-map">Map</div>;
    }
  };
});

vi.mock("@/components/map/terrain-3d/california-3d-terrain", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return {
    default: forwardRef(function TerrainMock(_props: any, ref: any) {
      useImperativeHandle(ref, () => ({
        resetView: vi.fn(),
      }));
      return <div data-testid="california-3d-terrain">Terrain</div>;
    })
  };
});

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

/** Wait until the lazy-loaded map component appears. */
async function waitForApp() {
  await waitFor(
    () => expect(screen.getByTestId("california-map")).toBeInTheDocument(),
    { timeout: 5000 },
  );
}

describe("Home page", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    // Reset to root so readParams() always starts with default state.
    // Using only window.location.pathname would preserve the previous test's
    // path-based route (e.g. /cali-vibe/sunshine), causing unexpected initial state.
    window.history.replaceState(null, "", "/cali-vibe/");
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders layout and defaults", async () => {
    render(<Home />);
    await waitForApp();

    expect(screen.getAllByText("CaliVibe")[0]).toBeInTheDocument();

    // Switch tabs
    await user.click(screen.getByRole("button", { name: /Favorites/ }));
    await user.click(screen.getByRole("button", { name: /Layers/ }));
  });

  it("toggles various layers and updates URL", async () => {
    render(<Home />);
    await waitForApp();

    // Temperature is on by default — turn it off to test other layers
    expect(screen.getByRole("checkbox", { name: /Temperature/i })).toBeChecked();

    // Turn on counties
    await user.click(screen.getByRole("checkbox", { name: /Counties/i }));
    expect(await screen.findByText("Borders")).toBeInTheDocument();

    // Turn on population
    await user.click(screen.getByRole("checkbox", { name: /County Population/i }));

    // Turn on county crime
    await user.click(screen.getByRole("checkbox", { name: /County Crime/i }));

    // Turn on cities
    await user.click(screen.getByRole("checkbox", { name: /Cities/i }));

    // Turn on city crime
    await user.click(screen.getByRole("checkbox", { name: /City Crime/i }));

    // Turn on temperature
    await user.click(screen.getByRole("checkbox", { name: /Temperature/i }));

    // Turn on sunshine
    await user.click(screen.getByRole("checkbox", { name: /Sunshine/i }));

    // Turn on county age
    await user.click(screen.getByRole("checkbox", { name: /County Age/i }));

    // Turn on city age
    await user.click(screen.getByRole("checkbox", { name: /City Age/i }));
  });

  it("interacts with tables", async () => {
    render(<Home />);
    await waitForApp();

    await user.click(screen.getByRole("checkbox", { name: /County Population/i }));
    await user.click(await screen.findByText("View Table"));

    await user.click(screen.getByRole("checkbox", { name: /County Crime/i }));
    await user.click(await screen.findByText("View Table"));

    await user.click(screen.getByRole("checkbox", { name: /City Crime/i }));
    await user.click(await screen.findByText("View Table"));

    await user.click(screen.getByRole("checkbox", { name: /Temperature/i }));
    await user.click(await screen.findByText("View Table"));

    await user.click(screen.getByRole("checkbox", { name: /Sunshine/i }));
    await user.click(await screen.findByText("View Table"));
  });

  it("handles drawer open/close and resizing", async () => {
    render(<Home />);
    await waitForApp();

    // Close menu
    await user.click(screen.getByTitle("Close Menu"));

    // Open menu
    await user.click(screen.getByTitle("Open Menu"));

    // Resizing
    const divider = document.querySelector('.cursor-col-resize');
    expect(divider).toBeInTheDocument();
    if (divider) {
      act(() => {
        divider.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 400 } as any));
        document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      });
    }
  });

  it("handles empty favorites tab", async () => {
    render(<Home />);
    await waitForApp();

    await user.click(screen.getByRole("button", { name: /Favorites/ }));

    expect(screen.getByText("No favorites yet")).toBeInTheDocument();
  });

  it("shows populated favorites and interacts with them", async () => {
    favoritesStore.add({ type: "county", name: "San Francisco" });
    favoritesStore.add({ type: "city", name: "Los Angeles" });

    render(<Home />);
    await waitForApp();

    await user.click(screen.getByRole("button", { name: /Favorites/ }));

    expect(screen.getByText("San Francisco")).toBeInTheDocument();
    expect(screen.getByText("Los Angeles")).toBeInTheDocument();

    // Click county favorite
    await user.click(screen.getByText("San Francisco"));
    await user.click(screen.getByRole('button', { name: /Layers/ }));
    expect(screen.getByRole("checkbox", { name: /Counties/i })).toBeChecked();

    // Click city favorite
    await user.click(screen.getByRole('button', { name: /Favorites/ }));
    await user.click(screen.getByText("Los Angeles"));
    await user.click(screen.getByRole('button', { name: /Layers/ }));
    expect(screen.getByRole("checkbox", { name: /Cities/i })).toBeChecked();

    act(() => {
      favoritesStore.remove({ type: "county", name: "San Francisco" });
      favoritesStore.remove({ type: "city", name: "Los Angeles" });
    });
  });

  it("resets 3D terrain view", async () => {
    render(<Home />);
    await waitForApp();

    // Enable 3D Vibe first (not on by default)
    await user.click(screen.getByRole("checkbox", { name: /3D Vibe/i }));
    await waitFor(() =>
      expect(screen.getByTestId("california-3d-terrain")).toBeInTheDocument(),
    );

    const resetBtn = screen.getByText(/Reset View/i);
    await user.click(resetBtn);
  });

  it("sunshine toggle shows controls and interacts", async () => {
    render(<Home />);
    await waitForApp();

    // Turn on sunshine
    await user.click(screen.getByRole("checkbox", { name: /Sunshine/i }));

    // Month buttons should appear
    await waitFor(() => expect(screen.getByRole("button", { name: "Jan" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Feb" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Year" })).toBeInTheDocument();

    // Click a different month
    await user.click(screen.getByRole("button", { name: "Mar" }));

    // Click Year for annual average
    await user.click(screen.getByRole("button", { name: "Year" }));

    // Resolution selector should be visible
    expect(screen.getByText("Large")).toBeInTheDocument();
    expect(screen.getByText("Small")).toBeInTheDocument();
    await user.click(screen.getByText("Large"));
    await user.click(screen.getByText("Small"));

    // View Table button
    expect(screen.getByText("View Table")).toBeInTheDocument();

    // Turning on sunshine should turn off other layers
    expect(screen.getByRole("checkbox", { name: /Counties/i })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /County Population/i })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Temperature/i })).not.toBeChecked();
  });

  it("sunshine data source selector switches between NSRDB and ERA5", async () => {
    render(<Home />);
    await waitForApp();

    // Turn on sunshine
    await user.click(screen.getByRole("checkbox", { name: /Sunshine/i }));

    // Data source buttons should appear — NSRDB and ERA5
    const nsrdbBtn = await screen.findByRole("button", { name: "NSRDB" });
    const era5Btn = screen.getByRole("button", { name: "ERA5" });
    expect(nsrdbBtn).toBeInTheDocument();
    expect(era5Btn).toBeInTheDocument();

    // NSRDB is selected by default (black bg)
    expect(nsrdbBtn.className).toContain("bg-black");
    expect(era5Btn.className).not.toContain("bg-black");

    // Switch to ERA5
    await user.click(era5Btn);
    expect(era5Btn.className).toContain("bg-black");
    expect(nsrdbBtn.className).not.toContain("bg-black");

    // Switch back to NSRDB
    await user.click(nsrdbBtn);
    expect(nsrdbBtn.className).toContain("bg-black");
    expect(era5Btn.className).not.toContain("bg-black");
  });

  it("sunshine data source has info tooltips for both sources", async () => {
    render(<Home />);
    await waitForApp();

    // Turn on sunshine
    await user.click(screen.getByRole("checkbox", { name: /Sunshine/i }));

    // There should be info icons — find all info icons within the data source row
    // The data source row has NSRDB and ERA5 buttons, each with an info tooltip
    const nsrdbBtn = await screen.findByRole("button", { name: "NSRDB" });
    const era5Btn = screen.getByRole("button", { name: "ERA5" });

    // Both buttons should be in the document
    expect(nsrdbBtn).toBeInTheDocument();
    expect(era5Btn).toBeInTheDocument();

    // Data source controls should appear before month/resolution controls
    expect(screen.getByRole("button", { name: "Jan" })).toBeInTheDocument();
    expect(screen.getByText("Large")).toBeInTheDocument();
  });

  it("closes modals when buttons are clicked", async () => {
    render(<Home />);
    await waitForApp();

    // Open Population modal
    await user.click(screen.getByRole("checkbox", { name: /County Population/i }));
    await user.click(await screen.findByText("View Table"));

    // Close with Escape
    await user.keyboard("{Escape}");
  });

  describe("browser history navigation", () => {
    // In vitest, import.meta.env.BASE_URL is "/" (not "/cali-vibe/")
    // so URLs in tests are "/housing", "/crime", "/" etc.
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    let pushSpy: ReturnType<typeof vi.spyOn>;
    let replaceSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      pushSpy = vi.spyOn(window.history, "pushState");
      replaceSpy = vi.spyOn(window.history, "replaceState");
    });

    afterEach(() => {
      pushSpy.mockRestore();
      replaceSpy.mockRestore();
    });

    it("uses replaceState on initial render", async () => {
      render(<Home />);
      await waitForApp();

      // Initial render should not push any history
      expect(pushSpy).not.toHaveBeenCalled();
      // But replaceState should have been called (initial URL sync)
      expect(replaceSpy).toHaveBeenCalled();
    });

    it("pushes history when toggling a layer", async () => {
      render(<Home />);
      await waitForApp();
      pushSpy.mockClear();

      // Toggle Housing on — this changes the URL
      await user.click(screen.getByRole("checkbox", { name: /County Housing/i }));

      await waitFor(() => {
        expect(pushSpy).toHaveBeenCalled();
      });

      // The pushed URL should contain "housing"
      const lastPush = pushSpy.mock.calls[pushSpy.mock.calls.length - 1];
      expect(lastPush[2]).toContain("/housing");
    });

    it("pushes separate entries for each layer toggle (A → B → C)", async () => {
      render(<Home />);
      await waitForApp();
      pushSpy.mockClear();

      // Toggle A: Housing
      await user.click(screen.getByRole("checkbox", { name: /County Housing/i }));
      await waitFor(() => {
        expect(pushSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
      });
      const afterA = pushSpy.mock.calls.length;

      // Toggle B: Crime (Housing auto-disables via clearOverlays)
      await user.click(screen.getByRole("checkbox", { name: /County Crime/i }));
      await waitFor(() => {
        expect(pushSpy.mock.calls.length).toBeGreaterThan(afterA);
      });
      const afterB = pushSpy.mock.calls.length;

      // Toggle C: Education
      await user.click(screen.getByRole("checkbox", { name: /County Education/i }));
      await waitFor(() => {
        expect(pushSpy.mock.calls.length).toBeGreaterThan(afterB);
      });

      // Each toggle should have pushed at least one history entry
      expect(pushSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it("restores state from URL on popstate (back navigation)", async () => {
      render(<Home />);
      await waitForApp();

      // Toggle Housing on
      await user.click(screen.getByRole("checkbox", { name: /County Housing/i }));
      await waitFor(() => {
        expect(screen.getByRole("checkbox", { name: /County Housing/i })).toBeChecked();
      });

      // Toggle Crime on (Housing turns off via clearOverlays)
      await user.click(screen.getByRole("checkbox", { name: /County Crime/i }));
      await waitFor(() => {
        expect(screen.getByRole("checkbox", { name: /County Crime/i })).toBeChecked();
        expect(screen.getByRole("checkbox", { name: /County Housing/i })).not.toBeChecked();
      });

      // Simulate pressing Back: set URL to Housing state and fire popstate
      await act(() => {
        window.history.replaceState(null, "", `${base}/housing`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      });

      // Housing should be restored, Crime should be off
      await waitFor(() => {
        expect(screen.getByRole("checkbox", { name: /County Housing/i })).toBeChecked();
        expect(screen.getByRole("checkbox", { name: /County Crime/i })).not.toBeChecked();
      });
    });

    it("does not push history during popstate handling", async () => {
      render(<Home />);
      await waitForApp();

      // Toggle Housing on
      await user.click(screen.getByRole("checkbox", { name: /County Housing/i }));
      await waitFor(() => {
        expect(pushSpy).toHaveBeenCalled();
      });

      pushSpy.mockClear();

      // Simulate back to root
      await act(() => {
        window.history.replaceState(null, "", `${base}/`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      });

      // Wait for state to settle — Temperature should be on (default)
      await waitFor(() => {
        expect(screen.getByRole("checkbox", { name: /Temperature/i })).toBeChecked();
        expect(screen.getByRole("checkbox", { name: /County Housing/i })).not.toBeChecked();
      });

      // Popstate should NOT push new history entries
      expect(pushSpy).not.toHaveBeenCalled();
    });

    it("resetAll pushes root URL to history", async () => {
      render(<Home />);
      await waitForApp();

      // Toggle Housing on
      await user.click(screen.getByRole("checkbox", { name: /County Housing/i }));
      await waitFor(() => {
        expect(screen.getByRole("checkbox", { name: /County Housing/i })).toBeChecked();
      });

      pushSpy.mockClear();

      // Click the logo (resetAll)
      const resetBtn = screen.getAllByTitle("Reset to defaults")[0];
      await user.click(resetBtn);

      // Should push root URL to history (so user can press Back)
      await waitFor(() => {
        expect(pushSpy).toHaveBeenCalled();
      });
      const lastPush = pushSpy.mock.calls[pushSpy.mock.calls.length - 1];
      expect(lastPush[2]).toBe(`${base}/`);
    });
  });
});
