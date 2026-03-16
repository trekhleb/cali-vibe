import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMap, Marker } from "react-map-gl/maplibre";
import { IoMdLocate } from "react-icons/io";

interface LocateControlProps {
  /** Minimum zoom to fly to (user's current zoom is preserved if higher). */
  targetZoom?: number;
}

type Status = "idle" | "loading" | "active" | "error";

export default function LocateControl({ targetZoom = 10 }: LocateControlProps) {
  const { current: mapRef } = useMap();
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );
  const [status, setStatus] = useState<Status>("idle");
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const targetZoomRef = useRef(targetZoom);
  targetZoomRef.current = targetZoom;

  // Create a control group container inside MapLibre's top-right control area
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;

    function attach() {
      const ctrlArea = map!
        .getContainer()
        .querySelector(".maplibregl-ctrl-top-right");
      if (!ctrlArea) return;

      const wrapper = document.createElement("div");
      wrapper.className = "maplibregl-ctrl maplibregl-ctrl-group";
      ctrlArea.appendChild(wrapper);
      setContainer(wrapper);

      return wrapper;
    }

    // Controls may not be in the DOM yet — try now, then retry on load
    let wrapper = attach();
    if (!wrapper) {
      const onLoad = () => {
        wrapper = attach();
      };
      map.on("load", onLoad);
      return () => {
        map.off("load", onLoad);
        wrapper?.remove();
      };
    }

    return () => {
      wrapper?.remove();
    };
  }, [mapRef]);

  const handleClick = useCallback(() => {
    const map = mapRef?.getMap();
    if (!map) return;

    if (!navigator.geolocation) {
      setStatus("error");
      return;
    }

    // Secure context check (geolocation requires HTTPS or localhost)
    if (window.isSecureContext === false) {
      console.warn("Geolocation requires HTTPS or localhost");
      setStatus("error");
      return;
    }

    setStatus("loading");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude, latitude } = pos.coords;
        const zoom = Math.max(map.getZoom(), targetZoomRef.current);

        map.flyTo({ center: [longitude, latitude], zoom, duration: 2000 });
        setUserLocation([longitude, latitude]);
        setStatus("active");
      },
      (err) => {
        console.warn("Geolocation error:", err.message);
        setStatus("error");
        // Reset error state after 2 seconds
        setTimeout(() => setStatus("idle"), 2000);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [mapRef]);

  const color =
    status === "active"
      ? "#3b82f6"
      : status === "error"
        ? "#ef4444"
        : undefined;

  return (
    <>
      {container &&
        createPortal(
          <button
            type="button"
            title={
              status === "error"
                ? "Location unavailable"
                : "Find my location"
            }
            aria-label="Find my location"
            disabled={status === "loading"}
            onClick={handleClick}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: status === "loading" ? "wait" : "pointer",
              opacity: status === "loading" ? 0.5 : 1,
              color,
            }}
          >
            <IoMdLocate size={20} />
          </button>,
          container,
        )}

      {userLocation && (
        <Marker longitude={userLocation[0]} latitude={userLocation[1]}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              backgroundColor: "#3b82f6",
              border: "3px solid white",
              boxShadow: "0 0 6px rgba(59,130,246,0.5)",
            }}
          />
        </Marker>
      )}
    </>
  );
}
