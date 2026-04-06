import { useEffect, useMemo, useState } from "react";
import LegalModal from "./legal-modal";
import { SCHOOL_LABELS, type SchoolMetric } from "@/components/map/layers/county-schools-layer";

type SortDir = "asc" | "desc";
type SortKey = "name" | SchoolMetric;

interface SchoolsRow {
  name: string;
  schools: Record<string, number | null>;
}

interface SchoolsTableModalProps {
  open: boolean;
  onClose: () => void;
  dataUrl: string;
  title: string;
  nameLabel: string;
  activeSchoolMetric: SchoolMetric;
  onSelectName?: (name: string) => void;
}

const COLUMNS: { key: SchoolMetric; short: string }[] = [
  { key: "ela", short: "ELA (DFS)" },
  { key: "math", short: "Math (DFS)" },
  { key: "graduationRate", short: "Grad Rate" },
  { key: "schoolCount", short: "Schools" },
];

function formatVal(val: number | null, key: SchoolMetric): string {
  if (val == null) return "\u2014";
  if (key === "schoolCount") return val.toLocaleString("en-US");
  if (key === "graduationRate") return `${val.toFixed(1)}%`;
  return val >= 0 ? `+${val.toFixed(1)}` : val.toFixed(1);
}

export default function SchoolsTableModal({
  open,
  onClose,
  dataUrl,
  title,
  nameLabel,
  activeSchoolMetric,
  onSelectName,
}: SchoolsTableModalProps) {
  const [rows, setRows] = useState<SchoolsRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>(activeSchoolMetric);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    setSortKey(activeSchoolMetric);
    setSortDir(activeSchoolMetric === "ela" || activeSchoolMetric === "math" ? "desc" : "desc");
  }, [activeSchoolMetric]);

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
        const parsed: SchoolsRow[] = [];
        for (const feat of gj.features) {
          const { name, schools } = feat.properties;
          if (name && schools) {
            parsed.push({
              name,
              schools: typeof schools === "string" ? JSON.parse(schools) : schools,
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
      const av = a.schools[sortKey] ?? -9999;
      const bv = b.schools[sortKey] ?? -9999;
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
                  title={SCHOOL_LABELS[col.key]}
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
                  const val = row.schools[col.key] as number | null;
                  return (
                    <td
                      key={col.key}
                      className={`${tdBase} text-right ${col.key === sortKey ? "bg-amber-50 font-medium" : "text-gray-600"}`}
                    >
                      {formatVal(val, col.key)}
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
