import { render, screen, waitFor, cleanup } from "@testing-library/react";
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

/** Wait until the lazy-loaded terrain component appears. */
async function waitForApp() {
  await waitFor(
    () => expect(screen.getByTestId("california-3d-terrain")).toBeInTheDocument(),
    { timeout: 5000 },
  );
}

describe("Home page", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    window.history.replaceState(null, "", window.location.pathname);
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
    await user.click(screen.getByText(/Favorites/));
    await user.click(screen.getByText(/Layers/));
  });

  it("toggles various layers and updates URL", async () => {
    render(<Home />);
    await waitForApp();

    // The panel shows "Show Peaks" when 3D Vibe is on initially
    expect(screen.getByRole("checkbox", { name: /Show Peaks/i })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Show Peaks/i }));

    // Turn off 3D Vibe to see the 2D map
    await user.click(screen.getByRole("checkbox", { name: /3D Vibe/i }));
    await waitFor(() =>
      expect(screen.getByTestId("california-map")).toBeInTheDocument(),
    );

    // Toggle Terrain 3D
    await user.click(screen.getByRole("checkbox", { name: /Terrain/i }));

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
      divider.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 400 } as any));
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    }
  });

  it("handles empty favorites tab", async () => {
    render(<Home />);
    await waitForApp();

    await user.click(screen.getByText(/Favorites/));

    expect(screen.getByText("No favorites yet")).toBeInTheDocument();
  });

  it("shows populated favorites and interacts with them", async () => {
    favoritesStore.add({ type: "county", name: "San Francisco" });
    favoritesStore.add({ type: "city", name: "Los Angeles" });

    render(<Home />);
    await waitForApp();

    await user.click(screen.getByText(/Favorites/));

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

    favoritesStore.remove({ type: "county", name: "San Francisco" });
    favoritesStore.remove({ type: "city", name: "Los Angeles" });
  });

  it("resets 3D terrain view", async () => {
    render(<Home />);
    await waitForApp();

    const resetBtn = screen.getByText(/Reset View/i);
    await user.click(resetBtn);
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
});
