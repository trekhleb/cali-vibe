import { useEffect, useMemo, useState } from "react";
import LegalModal from "./legal-modal";

type SortDir = "asc" | "desc";
type SortKey = "name" | "population";

interface PopRow {
  name: string;
  population: number;
}

interface PopulationTableModalProps {
  open: boolean;
  onClose: () => void;
  dataUrl: string;
  title: string;
  nameLabel: string;
}

export default function PopulationTableModal({
  open,
  onClose,
  dataUrl,
  title,
  nameLabel,
}: PopulationTableModalProps) {
  const [rows, setRows] = useState<PopRow[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("population");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(dataUrl)
      .then((r) => r.json())
      .then((gj) => {
        if (cancelled) return;
        const parsed: PopRow[] = [];
        for (const feat of gj.features) {
          const { name, population } = feat.properties;
          if (name && population != null) {
            parsed.push({ name, population });
          }
        }
        setRows(parsed);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, dataUrl]);

  const total = useMemo(() => rows.reduce((s, r) => s + r.population, 0), [rows]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortKey === "name") {
        return sortDir === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      return sortDir === "asc"
        ? a.population - b.population
        : b.population - a.population;
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
              <th className={`${thBase} text-right`} onClick={() => toggleSort("population")}>
                Population{sortIndicator("population")}
              </th>
              <th className={`${thBase} text-right w-20`}>
                % of Total
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
                  {row.name}
                </td>
                <td className={`${tdBase} text-right ${sortKey === "population" ? "bg-amber-50 font-medium" : "text-gray-600"}`}>
                  {row.population.toLocaleString()}
                </td>
                <td className={`${tdBase} text-right text-gray-500`}>
                  {total > 0 ? ((row.population / total) * 100).toFixed(1) + "%" : "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && open && (
          <div className="py-12 text-center text-sm text-gray-400">Loading...</div>
        )}
      </div>
    </LegalModal>
  );
}
