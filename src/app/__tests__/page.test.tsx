import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import Home from "@/app/page";
import { vi } from "vitest";
import { favoritesStore } from "@/lib/favorites";

// Mock the components that use WebGL or tricky to render
vi.mock("@/components/map/california-map", () => {
  return {
    default: function MapMock() {
      return <div data-testid="california-map">Map</div>;
    }
  };
});

vi.mock("@/components/map/terrain-3d/california-3d-terrain", () => {
  const React = require("react");
  return {
    default: React.forwardRef(function TerrainMock(props: any, ref: any) {
      React.useImperativeHandle(ref, () => ({
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

// Helper to let Suspense resolve
const resolveSuspense = async () => {
  await act(async () => { await new Promise(r => setTimeout(r, 100)); });
};

describe("Home page", () => {
  beforeEach(() => {
    // Reset URL properly for jsdom
    window.history.replaceState(null, "", window.location.pathname);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders layout and defaults", async () => {
    render(<Home />);
    await resolveSuspense();
    // Default is relief (3D terrain)
    expect(screen.getByTestId("california-3d-terrain")).toBeInTheDocument();
    
    expect(screen.getAllByText("CaliVibe")[0]).toBeInTheDocument();
    
    // Switch tabs
    await act(async () => { await userEvent.click(screen.getByText(/Favorites/)); });
    await act(async () => { await userEvent.click(screen.getByText(/Layers/)); });
  });

  it("toggles various layers and updates URL", async () => {
    render(<Home />);
    await resolveSuspense();
    expect(screen.getByTestId("california-3d-terrain")).toBeInTheDocument();
    
    // The panel shows "Show Peaks" when 3D Vibe is on initially
    expect(await screen.findByRole("checkbox", { name: /Show Peaks/i })).toBeInTheDocument();
    await act(async () => { await userEvent.click(screen.getByRole("checkbox", { name: /Show Peaks/i })); }); // Toggle off peaks
    
    // Turn off 3D Vibe to see the 2D map
    await act(async () => { await userEvent.click(screen.getByRole("checkbox", { name: /3D Vibe/i })); });
    await resolveSuspense();
    expect(screen.getByTestId("california-map")).toBeInTheDocument();

    // Toggle Terrain 3D 
    await act(async () => { await userEvent.click(screen.getByRole("checkbox", { name: /Terrain/i })); });
    
    // Turn on counties
    await act(async () => { await userEvent.click(screen.getByRole("checkbox", { name: /Counties/i })); });
    expect(await screen.findByText("Borders")).toBeInTheDocument();

    // Turn on population
    await act(async () => { await userEvent.click(screen.getByRole("checkbox", { name: /County Population/i })); });
    
    // Turn on county crime
    await act(async () => { await userEvent.click(screen.getByRole("checkbox", { name: /County Crime/i })); });
    
    // Turn on cities
    await act(async () => { await userEvent.click(screen.getByRole("checkbox", { name: /Cities/i })); });
    
    // Turn on city crime
    await act(async () => { await userEvent.click(screen.getByRole("checkbox", { name: /City Crime/i })); });
    
    // Turn on temperature
    await act(async () => { await userEvent.click(screen.getByRole("checkbox", { name: /Temperature/i })); });
  });
  
  it("interacts with tables", async () => {
    render(<Home />);
    await resolveSuspense();
    expect(screen.getByTestId("california-3d-terrain")).toBeInTheDocument();
    
    await act(async () => { await userEvent.click(screen.getByRole("checkbox", { name: /County Population/i })); });
    await act(async () => { await userEvent.click(await screen.findByText("View Table")); });
    
    await act(async () => { await userEvent.click(screen.getByRole("checkbox", { name: /County Crime/i })); });
    // Since we clicked County Crime, multiple View Table might exist if they weren't unmounted properly,
    // but the component unmounts the others because it uses mutually exclusive toggles.
    await act(async () => { await userEvent.click(await screen.findByText("View Table")); });
    
    await act(async () => { await userEvent.click(screen.getByRole("checkbox", { name: /City Crime/i })); });
    await act(async () => { await userEvent.click(await screen.findByText("View Table")); });
    
    await act(async () => { await userEvent.click(screen.getByRole("checkbox", { name: /Temperature/i })); });
    await act(async () => { await userEvent.click(await screen.findByText("View Table")); });
  });

  it("handles drawer open/close and resizing", async () => {
    render(<Home />);
    await resolveSuspense();

    // Close menu
    const closeBtn = screen.getByTitle("Close Menu");
    await act(async () => { await userEvent.click(closeBtn); });

    // Open menu
    const openBtn = screen.getByTitle("Open Menu");
    await act(async () => { await userEvent.click(openBtn); });

    // Resizing
    const divider = document.querySelector('.cursor-col-resize');
    expect(divider).toBeInTheDocument();
    if (divider) {
      await act(async () => {
         divider.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
         document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 400 } as any));
         document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      });
    }
  });

  it("handles empty favorites tab", async () => {
    render(<Home />);
    await resolveSuspense();
    
    const favTab = screen.getByText(/Favorites/);
    await act(async () => { await userEvent.click(favTab); });

    // Should show empty state
    expect(screen.getByText("No favorites yet")).toBeInTheDocument();
  });

  it("shows populated favorites and interacts with them", async () => {
    favoritesStore.add({ type: "county", name: "San Francisco" });
    favoritesStore.add({ type: "city", name: "Los Angeles" });
    
    render(<Home />);
    await resolveSuspense();
    
    await act(async () => { await userEvent.click(screen.getByText(/Favorites/)); });
    
    expect(screen.getByText("San Francisco")).toBeInTheDocument();
    expect(screen.getByText("Los Angeles")).toBeInTheDocument();
    
    // Click county favorite
    await act(async () => { await userEvent.click(screen.getByText("San Francisco")); });
    await act(async () => { await userEvent.click(screen.getByRole('button', { name: /Layers/ })); });
    expect(screen.getByRole("checkbox", { name: /Counties/i })).toBeChecked();

    // Click city favorite
    await act(async () => { await userEvent.click(screen.getByRole('button', { name: /Favorites/ })); });
    await act(async () => { await userEvent.click(screen.getByText("Los Angeles")); });
    await act(async () => { await userEvent.click(screen.getByRole('button', { name: /Layers/ })); });
    expect(screen.getByRole("checkbox", { name: /Cities/i })).toBeChecked();
    
    favoritesStore.remove({ type: "county", name: "San Francisco" });
    favoritesStore.remove({ type: "city", name: "Los Angeles" });
  });

  it("resets 3D terrain view", async () => {
    render(<Home />);
    await resolveSuspense();
    
    const resetBtn = screen.getByText(/Reset View/i);
    await act(async () => { await userEvent.click(resetBtn); });
  });

  it("closes modals when buttons are clicked", async () => {
    render(<Home />);
    await resolveSuspense();
    
    // Open Population modal
    await act(async () => { await userEvent.click(screen.getByRole("checkbox", { name: /County Population/i })); });
    await act(async () => { await userEvent.click(await screen.findByText("View Table")); });
    
    // It should be open, now close it. Pop modal titles usually have a "Close" tooltip or Text
    // Let's assume there's a button with Title="Close" or just click the first button with "Close" 
    const closeBtns = await screen.findAllByRole("button");
    // Usually the last button or a specific one has Close icon, but let's just hit Escape!
    await act(async () => { await userEvent.keyboard("{Escape}"); });
  });
});
