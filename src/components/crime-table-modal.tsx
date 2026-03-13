import { useEffect, useMemo, useState } from "react";
import LegalModal from "./legal-modal";
import { CRIME_LABELS, type CrimeType } from "@/components/map/layers/county-crime-layer";

type SortDir = "asc" | "desc";
type DataMode = "rate" | "absolute";

interface CrimeRow {
  name: string;
  population: number;
  crime: Record<string, number>;
}

interface CrimeTableModalProps {
  open: boolean;
  onClose: () => void;
  dataUrl: string;
  title: string;
  nameLabel: string;
  activeCrimeType: CrimeType;
}

const COLUMNS: { key: CrimeType; short: string }[] = [
  { key: "total", short: "Total" },
  { key: "violentTotal", short: "Violent" },
  { key: "propertyTotal", short: "Property" },
  { key: "homicide", short: "Homicide" },
  { key: "rape", short: "Rape" },
  { key: "robbery", short: "Robbery" },
  { key: "aggAssault", short: "Agg. Assault" },
  { key: "burglary", short: "Burglary" },
  { key: "mvTheft", short: "MV Theft" },
  { key: "larceny", short: "Larceny" },
];

function getValue(row: CrimeRow, key: CrimeType, mode: DataMode): number | null {
  const rate = row.crime[key];
  if (rate == null) return null;
  if (mode === "rate") return rate;
  return Math.round((rate * row.population) / 100000);
}

function formatValue(val: number | null, mode: DataMode): string {
  if (val == null) return "\u2014";
  if (mode === "rate") return val.toFixed(1);
  return val.toLocaleString();
}

export default function CrimeTableModal({
  open,
  onClose,
  dataUrl,
  title,
  nameLabel,
  activeCrimeType,
}: CrimeTableModalProps) {
  const [rows, setRows] = useState<CrimeRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"name" | CrimeType>(activeCrimeType);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [dataMode, setDataMode] = useState<DataMode>("rate");

  // Sync default sort column when activeCrimeType changes externally
  useEffect(() => {
    setSortKey(activeCrimeType);
    setSortDir("desc");
  }, [activeCrimeType]);

  // Load data
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    fetch(dataUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((gj) => {
        if (cancelled) return;
        const parsed: CrimeRow[] = [];
        for (const feat of gj.features) {
          const { name, crime, population } = feat.properties;
          if (name && crime) {
            parsed.push({
              name,
              population: population ?? 0,
              crime: typeof crime === "string" ? JSON.parse(crime) : crime,
            });
          }
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
      const av = getValue(a, sortKey, dataMode) ?? 0;
      const bv = getValue(b, sortKey, dataMode) ?? 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return copy;
  }, [rows, sortKey, sortDir, dataMode]);

  function toggleSort(key: "name" | CrimeType) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function sortIndicator(key: "name" | CrimeType) {
    if (sortKey !== key) return null;
    return sortDir === "asc" ? " \u25B2" : " \u25BC";
  }

  const thBase =
    "sticky top-0 bg-gray-50 px-2 py-2 text-left text-[11px] font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap border-b border-gray-200";
  const tdBase = "px-2 py-1.5 text-sm tabular-nums";

  return (
    <LegalModal open={open} onClose={onClose} title={title} wide>
      <div className="border-b border-gray-200 px-5 py-2.5 flex items-center gap-3 bg-white flex-shrink-0">
        <span className="text-xs font-medium text-gray-500">Show:</span>
        <div className="inline-flex rounded-md border border-gray-200 text-xs font-medium overflow-hidden">
          <button
            onClick={() => setDataMode("rate")}
            className={`px-3 py-1.5 transition-colors ${dataMode === "rate" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            Per 100K
          </button>
          <button
            onClick={() => setDataMode("absolute")}
            className={`px-3 py-1.5 transition-colors border-l border-gray-200 ${dataMode === "absolute" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            Absolute
          </button>
        </div>
        <span className="text-[10px] text-gray-400">
          {dataMode === "rate" ? "Crimes per 100,000 residents" : "Total reported crimes"}
        </span>
      </div>
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
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`${thBase} text-right z-10`}
                  onClick={() => toggleSort(col.key)}
                  title={CRIME_LABELS[col.key]}
                >
                  {col.short}{sortIndicator(col.key)}
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
                  {row.name}
                </td>
                {COLUMNS.map((col) => {
                  const val = getValue(row, col.key, dataMode);
                  return (
                    <td
                      key={col.key}
                      className={`${tdBase} text-right ${col.key === sortKey ? "bg-amber-50 font-medium" : "text-gray-600"}`}
                    >
                      {formatValue(val, dataMode)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && open && (
          <div className="py-12 text-center text-sm text-gray-400">
            {error ? `Error: ${error}` : "Loading..."}
          </div>
        )}
      </div>
    </LegalModal>
  );
}
