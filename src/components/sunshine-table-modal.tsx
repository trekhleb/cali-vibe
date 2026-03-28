import { useEffect, useMemo, useState } from "react";
import LegalModal from "./legal-modal";
import { MONTH_LABELS, ANNUAL_MONTH } from "@/components/map/layers/sunshine-layer";

type SortDir = "asc" | "desc";
type SortKey = "name" | "nearestCity" | "annual" | number; // number = month index 0-11
type DistUnit = "km" | "mi";

interface CityPoint {
  name: string;
  lat: number;
  lng: number;
}

interface SunshineRow {
  h3: string;
  name: string;
  lat: number;
  lng: number;
  sunshine: number[];
  annual: number;
  nearestCity: string;
  nearestCityDist: number; // km
}

interface SunshineTableModalProps {
  open: boolean;
  onClose: () => void;
  dataUrl: string;
  title: string;
  nameLabel: string;
  activeMonth: number;
  onSelectHex?: (h3: string) => void;
}

function formatHours(h: number | null): string {
  if (h == null) return "\u2014";
  return `${h.toFixed(1)}`;
}

/** Haversine distance in km */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestCity(lat: number, lng: number, cities: CityPoint[]): { name: string; dist: number } {
  let best = { name: "\u2014", dist: Infinity };
  for (const city of cities) {
    const d = haversineKm(lat, lng, city.lat, city.lng);
    if (d < best.dist) best = { name: city.name, dist: d };
  }
  return best;
}

function formatDist(km: number, distUnit: DistUnit): string {
  const val = distUnit === "mi" ? km * 0.621371 : km;
  return `${Math.round(val)} ${distUnit}`;
}

export default function SunshineTableModal({
  open,
  onClose,
  dataUrl,
  title,
  nameLabel,
  activeMonth,
  onSelectHex,
}: SunshineTableModalProps) {
  const [rows, setRows] = useState<SunshineRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>(activeMonth);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [distUnit, setDistUnit] = useState<DistUnit>("mi");

  useEffect(() => {
    setSortKey(activeMonth === ANNUAL_MONTH ? "annual" : activeMonth);
  }, [activeMonth]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);

    const fetchJson = (url: string) => fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });

    Promise.all([
      fetchJson(dataUrl),
      fetchJson(`${import.meta.env.BASE_URL}data/california-city-labels.geojson`),
    ])
      .then(([gj, citiesGj]) => {
        if (cancelled) return;

        const cities: CityPoint[] = citiesGj.features.map((f: { properties: { name: string }; geometry: { coordinates: [number, number] } }) => ({
          name: f.properties.name,
          lng: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
        }));

        const parsed: SunshineRow[] = [];
        for (const feat of gj.features) {
          const props = feat.properties;
          if (!props) continue;
          const sunshine = typeof props.sunshine === "string" ? JSON.parse(props.sunshine) : props.sunshine;
          if (!sunshine) continue;

          let name = props.name;
          let lat = 0, lng = 0;

          if (feat.geometry?.type === "Point") {
            [lng, lat] = feat.geometry.coordinates;
          } else if (feat.geometry?.type === "Polygon") {
            const coords = feat.geometry.coordinates[0];
            for (const [x, y] of coords) { lng += x; lat += y; }
            lat /= coords.length;
            lng /= coords.length;
          }

          if (!name) {
            name = `${lat.toFixed(2)}\u00b0N, ${Math.abs(lng).toFixed(2)}\u00b0W`;
          }

          const nearest = findNearestCity(lat, lng, cities);
          const annual = sunshine.reduce((s: number, v: number) => s + (v ?? 0), 0) / 12;

          parsed.push({
            h3: props.h3 ?? "",
            name,
            lat,
            lng,
            sunshine,
            annual,
            nearestCity: nearest.name,
            nearestCityDist: nearest.dist,
          });
        }
        setRows(parsed);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Failed to load data");
      });
    return () => { cancelled = true; };
  }, [open, dataUrl]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortKey === "name") {
        return sortDir === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      if (sortKey === "nearestCity") {
        return sortDir === "asc"
          ? a.nearestCity.localeCompare(b.nearestCity)
          : b.nearestCity.localeCompare(a.nearestCity);
      }
      if (sortKey === "annual") {
        return sortDir === "asc" ? a.annual - b.annual : b.annual - a.annual;
      }
      const av = a.sunshine[sortKey] ?? -999;
      const bv = b.sunshine[sortKey] ?? -999;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "nearestCity" ? "asc" : "desc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return null;
    return sortDir === "asc" ? " \u25B2" : " \u25BC";
  }

  const thBase =
    "sticky top-0 bg-gray-50 px-2 py-2 text-left text-[11px] font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap border-b border-gray-200";
  const tdBase = "px-2 py-1.5 text-sm tabular-nums";

  return (
    <LegalModal open={open} onClose={onClose} title={title} wide>
      {/* Controls bar */}
      <div className="border-b border-gray-200 px-5 py-2.5 flex items-center gap-3 bg-white flex-shrink-0 flex-wrap">
        <span className="text-xs font-medium text-gray-500">Values:</span>
        <span className="text-[10px] text-gray-400">
          Average daily sunshine hours
        </span>
        <div className="ml-auto inline-flex rounded-md border border-gray-200 text-xs font-medium overflow-hidden">
          {(["mi", "km"] as DistUnit[]).map((d) => (
            <button
              key={d}
              onClick={() => setDistUnit(d)}
              className={`px-2.5 py-1.5 transition-colors ${d === "km" ? "border-l border-gray-200" : ""} ${distUnit === d ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th
                className={`${thBase} sticky left-0 z-20 pr-3`}
                onClick={() => toggleSort("name")}
              >
                <span className="inline-block w-8 text-center text-gray-400 font-normal">#</span>
                {nameLabel}{sortIndicator("name")}
              </th>
              <th
                className={`${thBase} z-10`}
                onClick={() => toggleSort("nearestCity")}
              >
                Nearest City{sortIndicator("nearestCity")}
              </th>
              {MONTH_LABELS.map((label, i) => (
                <th
                  key={i}
                  className={`${thBase} text-right z-10`}
                  onClick={() => toggleSort(i)}
                >
                  {label}{sortIndicator(i)}
                </th>
              ))}
              <th
                className={`${thBase} text-right z-10`}
                onClick={() => toggleSort("annual")}
              >
                Avg{sortIndicator("annual")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={row.name}
                className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
              >
                <td className={`${tdBase} font-medium text-gray-900 whitespace-nowrap sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                  <span className="inline-block w-8 text-center text-xs text-gray-400 font-normal">{i + 1}</span>
                  {onSelectHex && row.h3 ? (
                    <button
                      onClick={() => { onSelectHex(row.h3); onClose(); }}
                      className="text-left text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {row.name}
                    </button>
                  ) : (
                    row.name
                  )}
                </td>
                <td className={`${tdBase} text-gray-600 whitespace-nowrap`}>
                  {row.nearestCity}
                  <span className="ml-1 text-[11px] text-gray-400">
                    ({formatDist(row.nearestCityDist, distUnit)})
                  </span>
                </td>
                {MONTH_LABELS.map((_, mi) => (
                  <td
                    key={mi}
                    className={`${tdBase} text-right ${mi === sortKey ? "bg-amber-50 font-medium" : "text-gray-600"}`}
                  >
                    {formatHours(row.sunshine[mi])}
                  </td>
                ))}
                <td
                  className={`${tdBase} text-right ${sortKey === "annual" ? "bg-amber-50 font-medium" : "text-gray-600"}`}
                >
                  {formatHours(row.annual)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && open && (
          <div className="py-12 text-center text-sm text-gray-400">
            {error ? `Error: ${error}` : "Loading\u2026"}
          </div>
        )}
      </div>
    </LegalModal>
  );
}
