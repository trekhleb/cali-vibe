import { useEffect, useMemo, useState } from "react";
import LegalModal from "./legal-modal";
import {
  MONTH_LABELS,
  METRIC_LABELS,
  type TempMetric,
  type TempUnit,
} from "@/components/map/layers/temperature-layer";

type SortDir = "asc" | "desc";
type SortKey = "name" | "nearestCity" | number; // number = month index 0-11
type DistUnit = "km" | "mi";

interface CityPoint {
  name: string;
  lat: number;
  lng: number;
}

interface TempRow {
  h3: string;
  name: string;
  lat: number;
  lng: number;
  tmin: number[];
  tmax: number[];
  tavg: number[];
  nearestCity: string;
  nearestCityDist: number; // km
}

interface TemperatureTableModalProps {
  open: boolean;
  onClose: () => void;
  dataUrl: string;
  title: string;
  nameLabel: string;
  activeMonth: number;
  activeMetric: TempMetric;
  unit: TempUnit;
  onSelectHex?: (h3: string) => void;
}

function cToF(c: number): number {
  return c * 9 / 5 + 32;
}

function formatTemp(c: number | null, unit: TempUnit): string {
  if (c == null) return "\u2014";
  const val = unit === "F" ? cToF(c) : c;
  return `${Math.round(val)}°`;
}

function getValue(row: TempRow, metric: TempMetric, month: number): number | null {
  const arr = row[metric];
  if (!arr || arr[month] == null) return null;
  return arr[month];
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
  let best = { name: "—", dist: Infinity };
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

export default function TemperatureTableModal({
  open,
  onClose,
  dataUrl,
  title,
  nameLabel,
  activeMonth,
  activeMetric,
  unit,
  onSelectHex,
}: TemperatureTableModalProps) {
  const [rows, setRows] = useState<TempRow[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>(activeMonth);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [metric, setMetric] = useState<TempMetric>(activeMetric);
  const [tempUnit, setTempUnit] = useState<TempUnit>(unit);
  const [distUnit, setDistUnit] = useState<DistUnit>("mi");

  useEffect(() => {
    setSortKey(activeMonth);
    setMetric(activeMetric);
    setTempUnit(unit);
  }, [activeMonth, activeMetric, unit]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    Promise.all([
      fetch(dataUrl).then((r) => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/california-city-labels.geojson`).then((r) => r.json()),
    ])
      .then(([gj, citiesGj]) => {
        if (cancelled) return;

        // Parse cities
        const cities: CityPoint[] = citiesGj.features.map((f: { properties: { name: string }; geometry: { coordinates: [number, number] } }) => ({
          name: f.properties.name,
          lng: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
        }));

        const parsed: TempRow[] = [];
        for (const feat of gj.features) {
          const props = feat.properties;
          if (!props) continue;
          const tmin = typeof props.tmin === "string" ? JSON.parse(props.tmin) : props.tmin;
          const tmax = typeof props.tmax === "string" ? JSON.parse(props.tmax) : props.tmax;
          const tavg = typeof props.tavg === "string" ? JSON.parse(props.tavg) : props.tavg;
          if (!tmin || !tmax || !tavg) continue;

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
            name = `${lat.toFixed(2)}°N, ${Math.abs(lng).toFixed(2)}°W`;
          }

          const nearest = findNearestCity(lat, lng, cities);

          parsed.push({
            h3: props.h3 ?? "",
            name,
            lat,
            lng,
            tmin,
            tmax,
            tavg,
            nearestCity: nearest.name,
            nearestCityDist: nearest.dist,
          });
        }
        setRows(parsed);
      })
      .catch(() => {});
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
      const av = getValue(a, metric, sortKey) ?? -999;
      const bv = getValue(b, metric, sortKey) ?? -999;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return copy;
  }, [rows, sortKey, sortDir, metric]);

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
        <span className="text-xs font-medium text-gray-500">Metric:</span>
        <div className="inline-flex rounded-md border border-gray-200 text-xs font-medium overflow-hidden">
          {(["tmax", "tavg", "tmin"] as TempMetric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-3 py-1.5 transition-colors ${m !== "tmax" ? "border-l border-gray-200" : ""} ${metric === m ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              {METRIC_LABELS[m]}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-gray-400">
          {metric === "tmax" ? "Daily maximum (day)" : metric === "tmin" ? "Daily minimum (night)" : "24h average"}
        </span>
        <div className="ml-auto inline-flex rounded-md border border-gray-200 text-xs font-medium overflow-hidden">
          {(["F", "C"] as TempUnit[]).map((u) => (
            <button
              key={u}
              onClick={() => setTempUnit(u)}
              className={`px-2.5 py-1.5 transition-colors ${u === "C" ? "border-l border-gray-200" : ""} ${tempUnit === u ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              °{u}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-md border border-gray-200 text-xs font-medium overflow-hidden">
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
                      className="text-blue-600 hover:text-blue-800 hover:underline"
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
                {MONTH_LABELS.map((_, mi) => {
                  const val = getValue(row, metric, mi);
                  return (
                    <td
                      key={mi}
                      className={`${tdBase} text-right ${mi === sortKey ? "bg-amber-50 font-medium" : "text-gray-600"}`}
                    >
                      {formatTemp(val, tempUnit)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && open && (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        )}
      </div>
    </LegalModal>
  );
}
