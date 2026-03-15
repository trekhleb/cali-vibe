import { render, screen, act } from "@testing-library/react";
import California3DTerrain from "../california-3d-terrain";
import * as THREE from "three";

vi.mock("three", () => {
  class MockMesh {
    position = { y: 0 };
    geometry = { dispose: vi.fn() };
    material = { dispose: vi.fn() };
  }

  return {
    Scene: vi.fn(function() {
      return {
        add: vi.fn(),
        traverse: vi.fn(function(cb: any) {
          cb(new MockMesh());
          cb({ ...new MockMesh(), material: [{ dispose: vi.fn() }] });
        }),
      };
    }),
    PerspectiveCamera: vi.fn(function() {
      return {
        position: { set: vi.fn() },
        lookAt: vi.fn(),
        setViewOffset: vi.fn(),
        updateProjectionMatrix: vi.fn(),
        aspect: 1,
      };
    }),
    WebGLRenderer: vi.fn(function() {
      const el = document.createElement("canvas");
      return {
        setSize: vi.fn(),
        setPixelRatio: vi.fn(),
        shadowMap: { enabled: false, type: 0 },
        render: vi.fn(),
        dispose: vi.fn(),
        domElement: el,
      };
    }),
    Vector3: vi.fn(function() {
      return { copy: vi.fn() };
    }),
    DirectionalLight: vi.fn(function() {
      return {
        position: { copy: vi.fn() },
        add: vi.fn(),
        color: 0xffffff,
        shadow: {
          bias: 0,
          mapSize: { set: vi.fn() },
          camera: { near: 0, far: 0, left: 0, right: 0, top: 0, bottom: 0 },
        },
      };
    }),
    AmbientLight: vi.fn(),
    HemisphereLight: vi.fn(),
    TextureLoader: vi.fn(function() { return { load: vi.fn(function() { return { dispose: vi.fn() }; }) }; }),
    PlaneGeometry: vi.fn(function() {
      return {
        attributes: { position: { count: 10, setZ: vi.fn() } },
        setAttribute: vi.fn(),
        rotateX: vi.fn(),
        computeVertexNormals: vi.fn(),
        dispose: vi.fn(),
      };
    }),
    BufferAttribute: vi.fn(),
    MeshStandardMaterial: vi.fn(function() { return { dispose: vi.fn() }; }),
    MeshDepthMaterial: vi.fn(function() { return { dispose: vi.fn() }; }),
    CanvasTexture: vi.fn(),
    Mesh: MockMesh,
    ShadowMaterial: vi.fn(function() { return { dispose: vi.fn() }; }),
    PCFSoftShadowMap: 1,
    ACESFilmicToneMapping: 1,
    DoubleSide: 2,
    RGBADepthPacking: 3,
  };
});

vi.mock("three/examples/jsm/controls/OrbitControls.js", () => ({
  OrbitControls: vi.fn(function() {
    return {
      target: { set: vi.fn() },
      update: vi.fn(),
      dispose: vi.fn(),
    };
  }),
}));

vi.mock("three/examples/jsm/objects/Sky.js", () => ({
  Sky: vi.fn(function() {
    return {
      scale: { setScalar: vi.fn() },
      material: {
        uniforms: {
          turbidity: { value: 0 },
          rayleigh: { value: 0 },
          mieCoefficient: { value: 0 },
          mieDirectionalG: { value: 0 },
          sunPosition: { value: { copy: vi.fn() } },
        },
      },
    };
  }),
}));

vi.mock("three/examples/jsm/objects/Lensflare.js", () => ({
  Lensflare: vi.fn(function() {
    return {
      addElement: vi.fn(),
    };
  }),
  LensflareElement: vi.fn(),
}));

vi.mock("three/examples/jsm/renderers/CSS2DRenderer.js", () => ({
  CSS2DRenderer: vi.fn(function() {
    const el = document.createElement("div");
    return {
      setSize: vi.fn(),
      domElement: el,
      render: vi.fn(),
    };
  }),
  CSS2DObject: vi.fn(function() {
    return {
      position: { set: vi.fn() },
      center: { set: vi.fn() },
      element: { querySelector: vi.fn() },
    };
  }),
}));

vi.mock("@/utils/fetch-json", () => ({
  fetchJsonCached: vi.fn(() => Promise.resolve({
    features: [
      {
        geometry: {
          type: "MultiPolygon",
          coordinates: [[[[0, 0], [1, 1], [0, 1], [0, 0]]]],
        },
      },
      {
        geometry: {
          type: "Polygon",
          coordinates: [[[0, 0], [1, 1], [0, 1], [0, 0]]],
        },
      }
    ],
  })),
}));

describe("California3DTerrain", () => {
  let mockContext: any;
  let OriginalImage: any;
  let OriginalResizeObserver: any;

  beforeAll(() => {
    OriginalImage = global.Image;
    OriginalResizeObserver = global.ResizeObserver;

    global.ResizeObserver = class {
      callback: any;
      constructor(callback: any) {
        this.callback = callback;
      }
      observe(el: Element) {
        // Trigger resize observer right away to get line coverage
        Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true });
        Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true });
        this.callback([{ target: el }]);
      }
      unobserve() {}
      disconnect() {}
    } as any;

    global.Image = class {
      onload: any;
      onerror: any;
      src: any;
      crossOrigin: any;
      constructor() {
        setTimeout(() => this.onload && this.onload(), 0);
      }
    } as any;

    mockContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(4 * 4 * 4), // small dummy array
      })),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
    };

    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext) as any;
  });

  afterAll(() => {
    global.Image = OriginalImage;
    global.ResizeObserver = OriginalResizeObserver;
  });

  it("renders without crashing, handles resize, and handles mask fallback", async () => {
    // Cause fetchJsonCached to fail for the mask fallback branch coverage
    const { fetchJsonCached } = await import("@/utils/fetch-json");
    (fetchJsonCached as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Network Error"));

    const { unmount, rerender } = render(<California3DTerrain overlayOffset={100} showPeaks={false} />);
    
    // Wait for the async effect to finish loading
    await act(async () => {
      await new Promise(r => setTimeout(r, 100)); // Wait for loads to trigger
      await new Promise(r => setTimeout(r, 150)); // Wait for resize observer
    });
    
    // Rerender to test the overlayOffset useEffect
    rerender(<California3DTerrain overlayOffset={200} showPeaks={true} peakUnit="m" />);

    // Should indicate loading is complete
    expect(screen.queryByText(/Generating atmosphere/i)).not.toBeInTheDocument();

    // Verify it cleans up
    unmount();
  });

  it("renders with successful mask generation", async () => {
    const { unmount } = render(<California3DTerrain />);
    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });
    unmount();
  });
});
