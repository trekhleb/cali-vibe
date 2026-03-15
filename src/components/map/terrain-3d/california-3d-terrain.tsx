import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { Lensflare, LensflareElement } from "three/examples/jsm/objects/Lensflare.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

// --- Tile grid configuration (zoom 6, covering California) ---
const ZOOM = 7;
const TX0 = 19;
const TX1 = 23;
const TY0 = 47;
const TY1 = 52;
const TILE_SIZE = 256;
const COLS = TX1 - TX0 + 1;
const ROWS = TY1 - TY0 + 1;
const W = COLS * TILE_SIZE;
const H = ROWS * TILE_SIZE;

const IS_VIEW_FROM_TOP = false;

const TILE_URL =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const GEOJSON_URL = `${import.meta.env.BASE_URL}data/california-counties.geojson`;

const MAX_ELEV = 4421;
const ELEV_SCALE = 0.03;
const STEP = 1;

const CENTER_X = 0.002;
const CENTER_Z = 0.025;

// --- High-Contrast Vintage Relief Color Ramp ---
const RAMP: [number, number, number, number][] = [
  [-100, 0.40, 0.55, 0.40],
  [0, 0.65, 0.75, 0.50],
  [150, 0.55, 0.65, 0.40],
  [400, 0.75, 0.65, 0.40],
  [900, 0.60, 0.40, 0.25],
  [1500, 0.40, 0.25, 0.15],
  [2500, 0.50, 0.45, 0.40],
  [3500, 0.85, 0.85, 0.85],
  [4421, 1.00, 1.00, 1.00],
];

function sampleRamp(elev: number): [number, number, number] {
  if (elev <= RAMP[0][0]) return [RAMP[0][1], RAMP[0][2], RAMP[0][3]];
  for (let i = 1; i < RAMP.length; i++) {
    if (elev <= RAMP[i][0]) {
      const [e0, r0, g0, b0] = RAMP[i - 1];
      const [e1, r1, g1, b1] = RAMP[i];
      const t = (elev - e0) / (e1 - e0);
      return [
        r0 + (r1 - r0) * t,
        g0 + (g1 - g0) * t,
        b0 + (b1 - b0) * t,
      ];
    }
  }
  const l = RAMP[RAMP.length - 1];
  return [l[1], l[2], l[3]];
}

function decodeTerr(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

function lonLatToPx(lon: number, lat: number): [number, number] {
  const n = 2 ** ZOOM;
  const tx = ((lon + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const ty =
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  return [(tx - TX0) * TILE_SIZE, (ty - TY0) * TILE_SIZE];
}

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// --- Famous California Peaks ---
const PEAKS = [
  { name: "Mt. Whitney", lat: 36.578581, lon: -118.291995, elevFt: 14505 },
  { name: "Mt. Shasta", lat: 41.409196, lon: -122.194888, elevFt: 14179 },
  { name: "Lassen Peak", lat: 40.488056, lon: -121.504722, elevFt: 10457 },
  { name: "Half Dome", lat: 37.746014, lon: -119.533054, elevFt: 8839 },
  { name: "Mt. Diablo", lat: 37.881592, lon: -121.914155, elevFt: 3849 },
  { name: "Mt. San Antonio (Baldy)", lat: 34.288889, lon: -117.646944, elevFt: 10064 },
  { name: "Mt. Tamalpais", lat: 37.923889, lon: -122.596667, elevFt: 2572 },
  { name: "Mt. Umunhum", lat: 37.159167, lon: -121.8625, elevFt: 3486 },
  { name: "Mt. San Gorgonio", lat: 34.099167, lon: -116.825, elevFt: 11503 },
  { name: "Mt. San Jacinto", lat: 33.814722, lon: -116.679444, elevFt: 10834 },
  { name: "Telescope Peak", lat: 36.169722, lon: -117.089167, elevFt: 11049 },
];

export interface California3DTerrainRef {
  resetView: () => void;
}

const California3DTerrain = forwardRef<
  California3DTerrainRef,
  { className?: string; overlayOffset?: number; showPeaks?: boolean; peakUnit?: "ft" | "m" }
>(({ className, overlayOffset = 0, showPeaks = true, peakUnit = "ft" }, forwardedRef) => {
  const ref = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const peakLabelsRef = useRef<CSS2DObject[]>([]);
  const overlayOffsetRef = useRef(overlayOffset);
  overlayOffsetRef.current = overlayOffset;
  const showPeaksRef = useRef(showPeaks);
  showPeaksRef.current = showPeaks;
  const peakUnitRef = useRef(peakUnit);
  peakUnitRef.current = peakUnit;

  useImperativeHandle(forwardedRef, () => ({
    resetView: () => {
      if (controlsRef.current && cameraRef.current) {
        cameraRef.current.position.set(-0.1, 0.9, 1.2);
        controlsRef.current.target.set(CENTER_X, 0, CENTER_Z);
        controlsRef.current.update();
      }
    }
  }));
  const [loading, setLoading] = useState(true);

  // We need to keep a ref to the camera to update its offset when `overlayOffset` changes
  // outside of the initial setup effect.
  useEffect(() => {
    if (cameraRef.current && ref.current) {
      const w = ref.current.clientWidth;
      const h = ref.current.clientHeight;
      if (w > 0 && h > 0) {
        cameraRef.current.setViewOffset(w, h, -overlayOffset / 2, 0, w, h);
        cameraRef.current.updateProjectionMatrix();
      }
    }
  }, [overlayOffset]);

  // Update peak labels dynamically without rebuilding the scene
  useEffect(() => {
    peakLabelsRef.current.forEach((label, i) => {
      label.visible = showPeaks;
      if (showPeaks) {
        const peak = PEAKS[i];
        const val = peakUnit === "m" ? Math.round(peak.elevFt * 0.3048) : peak.elevFt;

        const span = label.element.querySelector('.peak-elev-label');
        if (span) {
          span.textContent = `${val.toLocaleString()} ${peakUnit}`;
        }
      }
    });
  }, [showPeaks, peakUnit]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let dead = false;

    // --- Scene ---
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      25,
      el.clientWidth / el.clientHeight,
      0.01,
      1000
    );

    if (IS_VIEW_FROM_TOP) {
      camera.position.set(CENTER_X, 2.3, CENTER_Z + 0.01);
      camera.lookAt(CENTER_X, 0, CENTER_Z);
    }
    else {
      // Adjusted camera to match the zoomed-in screenshot view
      camera.position.set(-0.1, 0.9, 1.2);
    }

    // --- Renderers ---
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) {
      console.warn("WebGL context could not be created:", e);
      setLoading(false);
      return () => { dead = true; };
    }
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    el.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(el.clientWidth, el.clientHeight);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0px";
    labelRenderer.domElement.style.pointerEvents = "none";
    el.appendChild(labelRenderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    cameraRef.current = camera;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.3;
    controls.maxDistance = 5;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.target.set(CENTER_X, 0, CENTER_Z);
    controls.update();

    // ==========================================
    // --- THE CALIFORNIA GOLDEN HOUR ---
    // ==========================================

    const sky = new Sky();
    sky.scale.setScalar(450);
    scene.add(sky);

    const skyUniforms = sky.material.uniforms;
    skyUniforms["turbidity"].value = 8.5;
    skyUniforms["rayleigh"].value = 2.5;
    skyUniforms["mieCoefficient"].value = 0.005;
    skyUniforms["mieDirectionalG"].value = 0.8;

    // Lifted the Y axis of the sun from 2.5 up to 12.0. 
    // This allows light to clear the coastal mountains and hit the valley floor
    const sunPosition = new THREE.Vector3(-50, 3, 15);
    sky.material.uniforms["sunPosition"].value.copy(sunPosition);

    const sunLight = new THREE.DirectionalLight(0xffaa55, 3.8); // Slightly softened intensity
    sunLight.position.copy(sunPosition);
    sunLight.castShadow = true;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.mapSize.set(4096, 4096);
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 100;

    const sc = 6.0;
    sunLight.shadow.camera.left = -sc;
    sunLight.shadow.camera.right = sc;
    sunLight.shadow.camera.top = sc;
    sunLight.shadow.camera.bottom = -sc;
    scene.add(sunLight);

    // Boosted ambient and fill lights slightly to reveal detail in the shadowed valleys
    scene.add(new THREE.AmbientLight(0x3a2a4a, 0.5));

    const fillLight = new THREE.HemisphereLight(0xaa7755, 0x1a1a2a, 0.6);
    scene.add(fillLight);

    const textureLoader = new THREE.TextureLoader();
    const textureFlare0 = textureLoader.load("https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/lensflare/lensflare0.png");
    const textureFlare3 = textureLoader.load("https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/lensflare/lensflare3.png");

    const lensflare = new Lensflare();
    lensflare.addElement(new LensflareElement(textureFlare0, 500, 0, sunLight.color));
    lensflare.addElement(new LensflareElement(textureFlare3, 60, 0.6));
    lensflare.addElement(new LensflareElement(textureFlare3, 70, 0.7));
    lensflare.addElement(new LensflareElement(textureFlare3, 120, 0.9));
    lensflare.addElement(new LensflareElement(textureFlare3, 70, 1.0));
    sunLight.add(lensflare);

    // --- Render loop ---
    let frameId: number;
    (function animate() {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    })();

    // --- Resize (debounced) ---
    let resizeTimer: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      if (dead) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (dead) return;
        const w = el.clientWidth;
        const h = el.clientHeight;
        if (w === 0 || h === 0) return;
        camera.aspect = w / h;
        camera.setViewOffset(w, h, -overlayOffsetRef.current / 2, 0, w, h);
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        labelRenderer.setSize(w, h);
      }, 100);
    });
    ro.observe(el);

    // --- Build terrain async ---
    (async () => {
      const cv = document.createElement("canvas");
      cv.width = W;
      cv.height = H;
      const ctx = cv.getContext("2d")!;

      const jobs: Promise<void>[] = [];
      for (let ty = TY0; ty <= TY1; ty++) {
        for (let tx = TX0; tx <= TX1; tx++) {
          const url = TILE_URL.replace("{z}", String(ZOOM))
            .replace("{x}", String(tx))
            .replace("{y}", String(ty));
          jobs.push(
            loadImg(url)
              .then((img) => {
                ctx.drawImage(
                  img,
                  (tx - TX0) * TILE_SIZE,
                  (ty - TY0) * TILE_SIZE
                );
              })
              .catch(() => { })
          );
        }
      }
      await Promise.all(jobs);
      if (dead) return;

      const pixels = ctx.getImageData(0, 0, W, H).data;

      // 2. California mask from GeoJSON
      let maskCanvas: HTMLCanvasElement | null = null;
      try {
        const { fetchJsonCached } = await import("@/utils/fetch-json");
        const gj = await fetchJsonCached(GEOJSON_URL) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        if (dead) return;
        const mc = document.createElement("canvas");
        maskCanvas = mc;
        mc.width = W;
        mc.height = H;
        const mx = mc.getContext("2d")!;

        mx.fillStyle = "black";
        mx.fillRect(0, 0, W, H);

        mx.fillStyle = "white";

        for (const feat of gj.features) {
          const coords =
            feat.geometry.type === "MultiPolygon"
              ? feat.geometry.coordinates
              : [feat.geometry.coordinates];
          for (const poly of coords) {
            mx.beginPath();
            for (const ring of poly) {
              for (let i = 0; i < ring.length; i++) {
                const [px, py] = lonLatToPx(ring[i][0], ring[i][1]);
                if (i === 0) mx.moveTo(px, py);
                else mx.lineTo(px, py);
              }
              mx.closePath();
            }
            mx.fill("evenodd");
          }
        }
      } catch {
        // Fallback
      }
      if (dead) return;

      // 3. Build geometry
      const segW = Math.floor(W / STEP);
      const segH = Math.floor(H / STEP);
      const geo = new THREE.PlaneGeometry(1, 1, segW - 1, segH - 1);
      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);

      for (let j = 0; j < segH; j++) {
        for (let i = 0; i < segW; i++) {
          const vi = j * segW + i;
          const px = Math.min(i * STEP, W - 1);
          const py = Math.min(j * STEP, H - 1);
          const pi = (py * W + px) * 4;

          const elev = decodeTerr(pixels[pi], pixels[pi + 1], pixels[pi + 2]);
          const e = Math.max(0, elev);

          pos.setZ(vi, (e / MAX_ELEV) * ELEV_SCALE);

          const [cr, cg, cb] = sampleRamp(e);
          colors[vi * 3] = cr;
          colors[vi * 3 + 1] = cg;
          colors[vi * 3 + 2] = cb;
        }
      }

      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geo.rotateX(-Math.PI / 2);
      geo.computeVertexNormals();

      const matProps: THREE.MeshStandardMaterialParameters = {
        vertexColors: true,
        roughness: 0.85,
        metalness: 0.1,
        side: THREE.DoubleSide,
        flatShading: false,
      };

      let alphaTexture = null;
      if (maskCanvas) {
        alphaTexture = new THREE.CanvasTexture(maskCanvas);
        matProps.alphaMap = alphaTexture;
        matProps.transparent = true;
        matProps.alphaTest = 0.5;
      }

      const mat = new THREE.MeshStandardMaterial(matProps);
      const mesh = new THREE.Mesh(geo, mat);

      if (alphaTexture) {
        mesh.customDepthMaterial = new THREE.MeshDepthMaterial({
          depthPacking: THREE.RGBADepthPacking,
          alphaMap: alphaTexture,
          alphaTest: 0.5
        });
      }

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      // --- Massive Shadow Catcher ---
      const shadowGeo = new THREE.PlaneGeometry(15, 15);
      shadowGeo.rotateX(-Math.PI / 2);

      const shadowMat = new THREE.ShadowMaterial({
        opacity: 0.8, // Softened the ground shadow opacity slightly since the sun is higher
      });

      const shadowCatcher = new THREE.Mesh(shadowGeo, shadowMat);
      shadowCatcher.position.y = -0.0001;
      shadowCatcher.receiveShadow = true;
      scene.add(shadowCatcher);

      // --- Peak Labels ---
      for (const peak of PEAKS) {
        const [px, py] = lonLatToPx(peak.lon, peak.lat);
        // Map pixel coordinates to the -0.5 .. 0.5 3D plane scale
        const localX = (px / W) - 0.5;
        const localZ = (py / H) - 0.5;
        const elevMeters = peak.elevFt * 0.3048;
        const localY = (elevMeters / MAX_ELEV) * ELEV_SCALE;

        const unit = peakUnitRef.current;
        const val = unit === "m" ? Math.round(elevMeters) : peak.elevFt;

        const div = document.createElement("div");
        div.className = "flex flex-col items-center mt-[-10px] drop-shadow-lg";
        div.innerHTML = `
          <div class="px-2 py-1 rounded bg-black/60 backdrop-blur-sm border border-white/10 text-white text-xs whitespace-nowrap leading-tight flex flex-col items-center">
            <span class="font-bold text-amber-100">${peak.name}</span>
            <span class="peak-elev-label text-[10px] text-gray-300">${val.toLocaleString()} ${unit}</span>
          </div>
          <div class="w-px h-6 bg-gradient-to-t from-white/80 to-transparent"></div>
          <div class="w-1.5 h-1.5 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>
        `;

        const label = new CSS2DObject(div);
        label.position.set(localX, localY, localZ);
        label.center.set(0.5, 1);
        label.visible = showPeaksRef.current;
        scene.add(label);

        peakLabelsRef.current.push(label);
      }

      if (!dead) setLoading(false);
    })();

    return () => {
      dead = true;
      cancelAnimationFrame(frameId);
      clearTimeout(resizeTimer);
      ro.disconnect();
      controls.dispose();
      textureFlare0.dispose();
      textureFlare3.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material))
            obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      labelRenderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ paddingLeft: overlayOffset }}>
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            <div className="text-sm text-white font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
              Generating atmosphere&hellip;
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

California3DTerrain.displayName = "California3DTerrain";

export default California3DTerrain;