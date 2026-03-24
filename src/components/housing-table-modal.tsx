import { useEffect, useMemo, useState } from "react";
import LegalModal from "./legal-modal";
import { HOUSING_LABELS, type HousingMetric } from "@/components/map/layers/county-housing-layer";

type SortDir = "asc" | "desc";
type SortKey = "name" | HousingMetric;

interface HousingRow {
  name: string;
  housing: Record<string, number | null>;
}

interface HousingTableModalProps {
  open: boolean;
  onClose: () => void;
  dataUrl: string;
  title: string;
  nameLabel: string;
  activeHousingMetric: HousingMetric;
  onSelectName?: (name: string) => void;
  visibleMetrics?: HousingMetric[];
}

const ALL_COLUMNS: { key: HousingMetric; short: string }[] = [
  { key: "homeValue", short: "Home Value" },
  { key: "rent", short: "Rent" },
  { key: "income", short: "Income" },
];

function formatCurrency(val: number | null, metric: HousingMetric): string {
  if (val == null) return "\u2014";
  if (metric === "rent") return `$${val.toLocaleString()}`;
  if (metric === "income") return `$${val.toLocaleString()}`;
  if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
  return `$${(val / 1000).toFixed(0)}K`;
}

export default function HousingTableModal({
  open,
  onClose,
  dataUrl,
  title,
  nameLabel,
  activeHousingMetric,
  onSelectName,
  visibleMetrics,
}: HousingTableModalProps) {
  const columns = visibleMetrics
    ? ALL_COLUMNS.filter((col) => visibleMetrics.includes(col.key))
    : ALL_COLUMNS;
  const [rows, setRows] = useState<HousingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>(activeHousingMetric);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    setSortKey(activeHousingMetric);
    setSortDir("desc");
  }, [activeHousingMetric]);

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
        const parsed: HousingRow[] = [];
        for (const feat of gj.features) {
          const { name, housing } = feat.properties;
          if (name && housing) {
            parsed.push({
              name,
              housing: typeof housing === "string" ? JSON.parse(housing) : housing,
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
      const av = a.housing[sortKey] ?? 0;
      const bv = b.housing[sortKey] ?? 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return null;
    return sortDir === "asc" ? " \u25B2" : " \u25BC";
  }

  const thBase =
    "sticky top-0 bg-gray-50 px-3 py-2 text-left text-[11px] font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap border-b border-gray-200";
  const tdBase = "px-3 py-1.5 text-sm tabular-nums";

  return (
    <LegalModal open={open} onClose={onClose} title={title}>
      <div className="-mx-5 -my-4 overflow-auto max-h-[calc(80dvh-60px)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={`${thBase} w-10 text-center`}>#</th>
              <th className={thBase} onClick={() => toggleSort("name")}>
                {nameLabel}{sortIndicator("name")}
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`${thBase} text-right`}
                  onClick={() => toggleSort(col.key)}
                  title={HOUSING_LABELS[col.key]}
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
                <td className={`${tdBase} text-center text-xs text-gray-400`}>
                  {i + 1}
                </td>
                <td className={`${tdBase} font-medium text-gray-900 whitespace-nowrap`}>
                  {onSelectName ? (
                    <button
                      onClick={() => { onSelectName(row.name); onClose(); }}
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {row.name}
                    </button>
                  ) : (
                    row.name
                  )}
                </td>
                {columns.map((col) => {
                  const val = row.housing[col.key] as number | null;
                  return (
                    <td
                      key={col.key}
                      className={`${tdBase} text-right ${col.key === sortKey ? "bg-amber-50 font-medium" : "text-gray-600"}`}
                    >
                      {formatCurrency(val, col.key)}
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
