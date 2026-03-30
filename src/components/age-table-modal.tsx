import { useEffect, useMemo, useState } from "react";
import LegalModal from "./legal-modal";
import { AGE_LABELS, type AgeMetric } from "@/components/map/layers/county-age-layer";

type SortDir = "asc" | "desc";
type SortKey = "name" | AgeMetric;

interface AgeRow {
  name: string;
  age: Record<string, number | null>;
}

interface AgeTableModalProps {
  open: boolean;
  onClose: () => void;
  dataUrl: string;
  title: string;
  nameLabel: string;
  activeAgeMetric: AgeMetric;
  onSelectName?: (name: string) => void;
}

const COLUMNS: { key: AgeMetric; short: string }[] = [
  { key: "under18", short: "< 18" },
  { key: "age18_34", short: "18–34" },
  { key: "age35_64", short: "35–64" },
  { key: "age65plus", short: "65+" },
  { key: "medianAge", short: "Median" },
];

export default function AgeTableModal({
  open,
  onClose,
  dataUrl,
  title,
  nameLabel,
  activeAgeMetric,
  onSelectName,
}: AgeTableModalProps) {
  const [rows, setRows] = useState<AgeRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>(activeAgeMetric);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    setSortKey(activeAgeMetric);
    setSortDir("desc");
  }, [activeAgeMetric]);

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
        const parsed: AgeRow[] = [];
        for (const feat of gj.features) {
          const { name, age } = feat.properties;
          if (name && age) {
            parsed.push({
              name,
              age: typeof age === "string" ? JSON.parse(age) : age,
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
      const av = a.age[sortKey] ?? 0;
      const bv = b.age[sortKey] ?? 0;
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

  function fmtVal(key: AgeMetric, val: number | null) {
    if (val == null) return "\u2014";
    if (key === "medianAge") return val.toFixed(1);
    return `${val.toFixed(1)}%`;
  }

  const thBase =
    "sticky top-0 bg-gray-50 px-2 py-2 text-left text-[11px] font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap border-b border-gray-200";
  const tdBase = "px-2 py-1.5 text-sm tabular-nums";

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
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`${thBase} text-right`}
                  onClick={() => toggleSort(col.key)}
                  title={AGE_LABELS[col.key]}
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
                <td className={`${tdBase} text-left font-medium text-gray-900`}>
                  {onSelectName ? (
                    <button
                      onClick={() => { onSelectName(row.name); onClose(); }}
                      className="text-left text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {row.name}
                    </button>
                  ) : (
                    row.name
                  )}
                </td>
                {COLUMNS.map((col) => {
                  const val = row.age[col.key] as number | null;
                  return (
                    <td
                      key={col.key}
                      className={`${tdBase} text-right ${col.key === sortKey ? "bg-amber-50 font-medium" : "text-gray-600"}`}
                    >
                      {fmtVal(col.key, val)}
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
