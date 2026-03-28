import { useEffect, useMemo, useState } from "react";
import LegalModal from "./legal-modal";
import { RACE_LABELS, type RaceMetric } from "@/components/map/layers/county-race-layer";

type SortDir = "asc" | "desc";
type SortKey = "name" | RaceMetric;

interface RaceRow {
  name: string;
  race: Record<string, number | null>;
}

interface RaceTableModalProps {
  open: boolean;
  onClose: () => void;
  dataUrl: string;
  title: string;
  nameLabel: string;
  activeRaceMetric: RaceMetric;
  onSelectName?: (name: string) => void;
}

const COLUMNS: { key: RaceMetric; short: string }[] = [
  { key: "white", short: "White" },
  { key: "hispanic", short: "Hispanic" },
  { key: "black", short: "Black" },
  { key: "asian", short: "Asian" },
  { key: "other", short: "Other" },
];

export default function RaceTableModal({
  open,
  onClose,
  dataUrl,
  title,
  nameLabel,
  activeRaceMetric,
  onSelectName,
}: RaceTableModalProps) {
  const [rows, setRows] = useState<RaceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>(activeRaceMetric);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    setSortKey(activeRaceMetric);
    setSortDir("desc");
  }, [activeRaceMetric]);

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
        const parsed: RaceRow[] = [];
        for (const feat of gj.features) {
          const { name, race } = feat.properties;
          if (name && race) {
            parsed.push({
              name,
              race: typeof race === "string" ? JSON.parse(race) : race,
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
      const av = a.race[sortKey] ?? 0;
      const bv = b.race[sortKey] ?? 0;
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
                  title={RACE_LABELS[col.key]}
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
                  const val = row.race[col.key] as number | null;
                  return (
                    <td
                      key={col.key}
                      className={`${tdBase} text-right ${col.key === sortKey ? "bg-amber-50 font-medium" : "text-gray-600"}`}
                    >
                      {val != null ? `${val.toFixed(1)}%` : "\u2014"}
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
