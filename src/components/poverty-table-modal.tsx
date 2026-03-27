import { useEffect, useMemo, useState } from "react";
import LegalModal from "./legal-modal";

type SortDir = "asc" | "desc";
type SortKey = "name" | "poverty";

interface PovertyRow {
  name: string;
  poverty: number;
}

interface PovertyTableModalProps {
  open: boolean;
  onClose: () => void;
  dataUrl: string;
  title: string;
  nameLabel: string;
  onSelectName?: (name: string) => void;
}

export default function PovertyTableModal({
  open,
  onClose,
  dataUrl,
  title,
  nameLabel,
  onSelectName,
}: PovertyTableModalProps) {
  const [rows, setRows] = useState<PovertyRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("poverty");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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
        const parsed: PovertyRow[] = [];
        for (const feat of gj.features) {
          const { name, poverty } = feat.properties;
          if (name && poverty != null) {
            const val = typeof poverty === "string" ? Number(poverty) : poverty;
            if (Number.isFinite(val)) {
              parsed.push({ name, poverty: val });
            }
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
      return sortDir === "asc" ? a.poverty - b.poverty : b.poverty - a.poverty;
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
              <th
                className={`${thBase} text-right`}
                onClick={() => toggleSort("poverty")}
              >
                Poverty Rate{sortIndicator("poverty")}
              </th>
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
                <td
                  className={`${tdBase} text-right ${sortKey === "poverty" ? "bg-amber-50 font-medium" : "text-gray-600"}`}
                >
                  {row.poverty.toFixed(1)}%
                </td>
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
