import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LocateControl from "@/components/map/locate-control";

vi.mock("react-icons/io", () => ({
  IoMdLocate: (props: any) => <span data-testid="locate-icon" {...props} />,
}));

const mockFlyTo = vi.fn();
const mockGetZoom = vi.fn(() => 5);

// The map container must be part of document.body so that the portal
// renders into the visible DOM (testing-library queries document.body).
let mapContainer: HTMLDivElement;

function createMapContainer() {
  mapContainer = document.createElement("div");
  const ctrlArea = document.createElement("div");
  ctrlArea.className = "maplibregl-ctrl-top-right";
  mapContainer.appendChild(ctrlArea);
  document.body.appendChild(mapContainer);
  return mapContainer;
}

const mockMap = {
  flyTo: mockFlyTo,
  getZoom: mockGetZoom,
  getContainer: () => mapContainer,
  on: vi.fn(),
  off: vi.fn(),
};

// Must be a stable reference — useMap() returning a new object each render
// would cause an infinite loop (useEffect depends on mapRef).
const stableMapRef = { current: { getMap: () => mockMap } };

vi.mock("react-map-gl/maplibre", () => ({
  useMap: () => stableMapRef,
  Marker: ({ children }: any) => <div data-testid="user-marker">{children}</div>,
}));

// jsdom doesn't provide navigator.geolocation — stub it
const mockGetCurrentPosition = vi.fn();
Object.defineProperty(navigator, "geolocation", {
  value: { getCurrentPosition: mockGetCurrentPosition },
  writable: true,
});

describe("LocateControl", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    createMapContainer();
    Object.defineProperty(window, "isSecureContext", { value: true, writable: true });
  });

  afterEach(() => {
    mapContainer?.remove();
  });

  it("renders locate button in the control area", () => {
    render(<LocateControl />);
    expect(screen.getByRole("button", { name: "Find my location" })).toBeInTheDocument();
  });

  it("flies to user location on click", async () => {
    mockGetCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({ coords: { longitude: -118.24, latitude: 34.05 } } as GeolocationPosition);
    });

    render(<LocateControl targetZoom={10} />);
    await user.click(screen.getByRole("button", { name: "Find my location" }));

    expect(mockFlyTo).toHaveBeenCalledWith({
      center: [-118.24, 34.05],
      zoom: 10,
      duration: 2000,
    });
    expect(screen.getByTestId("user-marker")).toBeInTheDocument();
  });

  it("preserves user zoom when already zoomed in beyond target", async () => {
    mockGetZoom.mockReturnValue(13);
    mockGetCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({ coords: { longitude: -118.24, latitude: 34.05 } } as GeolocationPosition);
    });

    render(<LocateControl targetZoom={10} />);
    await user.click(screen.getByRole("button", { name: "Find my location" }));

    expect(mockFlyTo).toHaveBeenCalledWith(
      expect.objectContaining({ zoom: 13 }),
    );
  });

  it("shows error state when geolocation fails", async () => {
    mockGetCurrentPosition.mockImplementation(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error({ code: 1, message: "User denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
      },
    );

    render(<LocateControl />);
    const button = screen.getByRole("button", { name: "Find my location" });
    await user.click(button);

    expect(button).toHaveStyle({ color: "#ef4444" });
    expect(button).toHaveAttribute("title", "Location unavailable");
  });

  it("shows error when not in secure context", async () => {
    Object.defineProperty(window, "isSecureContext", { value: false });

    render(<LocateControl />);
    const button = screen.getByRole("button", { name: "Find my location" });
    await user.click(button);

    expect(button).toHaveStyle({ color: "#ef4444" });
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
  });

  it("does not show marker before locating", () => {
    render(<LocateControl />);
    expect(screen.queryByTestId("user-marker")).not.toBeInTheDocument();
  });
});
