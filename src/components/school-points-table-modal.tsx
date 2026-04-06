import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LegalModal from "./legal-modal";
import type { SchoolPointColor, SchoolLevelFilter } from "@/components/map/layers/schools-point-layer";
import { SCHOOL_LEVEL_LABELS } from "@/components/map/layers/schools-point-layer";

type SortDir = "asc" | "desc";
type SortKey = "name" | "county" | "city" | "level" | "ela" | "math" | "graduationRate" | "rating";

interface SchoolRow {
  name: string;
  county: string;
  city: string;
  level: string;
  charter: boolean;
  ela: number | null;
  math: number | null;
  graduationRate: number | null;
  rating: number | null;
}

interface SchoolPointsTableModalProps {
  open: boolean;
  onClose: () => void;
  dataUrl: string;
  activeColorBy: SchoolPointColor;
  activeLevelFilter: SchoolLevelFilter;
  onSelectSchool?: (name: string) => void;
  onSelectCounty?: (name: string) => void;
  onSelectCity?: (name: string) => void;
}

const METRIC_COLUMNS: { key: SortKey; short: string; title: string }[] = [
  { key: "rating", short: "Rating", title: "Dashboard Rating (1–5)" },
  { key: "ela", short: "ELA", title: "ELA Distance from Standard" },
  { key: "math", short: "Math", title: "Math Distance from Standard" },
  { key: "graduationRate", short: "Grad %", title: "4-Year Graduation Rate" },
];

const RATING_COLORS: Record<number, string> = {
  1: "#ef4444",
  2: "#f97316",
  3: "#eab308",
  4: "#22c55e",
  5: "#3b82f6",
};

const ROW_HEIGHT = 33; // px per row
const OVERSCAN = 15; // extra rows above/below viewport

function defaultSortKey(colorBy: SchoolPointColor): SortKey {
  if (colorBy === "ela") return "ela";
  if (colorBy === "math") return "math";
  return "rating";
}

function formatVal(val: number | null, key: SortKey): string {
  if (val == null) return "\u2014";
  if (key === "rating") return String(val);
  if (key === "graduationRate") return `${val.toFixed(1)}%`;
  return val >= 0 ? `+${val.toFixed(1)}` : val.toFixed(1);
}

// Pre-compute lowercase strings once per row to avoid repeated toLowerCase() in filter
interface IndexedSchoolRow extends SchoolRow {
  _nameLower: string;
  _cityLower: string;
  _countyLower: string;
}

function indexRow(r: SchoolRow): IndexedSchoolRow {
  return { ...r, _nameLower: r.name.toLowerCase(), _cityLower: r.city.toLowerCase(), _countyLower: r.county.toLowerCase() };
}

export default function SchoolPointsTableModal({
  open,
  onClose,
  dataUrl,
  activeColorBy,
  activeLevelFilter,
  onSelectSchool,
  onSelectCounty,
  onSelectCity,
}: SchoolPointsTableModalProps) {
  const [rows, setRows] = useState<IndexedSchoolRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>(defaultSortKey(activeColorBy));
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [levelFilter, setLevelFilter] = useState<SchoolLevelFilter>(activeLevelFilter);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Virtualization state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  useEffect(() => {
    setSortKey(defaultSortKey(activeColorBy));
    setSortDir("desc");
  }, [activeColorBy]);

  useEffect(() => {
    setLevelFilter(activeLevelFilter);
  }, [activeLevelFilter]);

  // Debounce search input (150ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 150);
    return () => clearTimeout(t);
  }, [search]);

  // Reset scroll on filter/sort change
  useEffect(() => {
    if (scrollRef.current) {
      if (typeof scrollRef.current.scrollTo === "function") {
        scrollRef.current.scrollTo(0, 0);
      } else {
        scrollRef.current.scrollTop = 0;
      }
    }
    setScrollTop(0);
  }, [debouncedSearch, levelFilter, sortKey, sortDir]);

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
        const parsed: IndexedSchoolRow[] = [];
        for (const feat of gj.features) {
          const p = feat.properties;
          if (!p?.name) continue;
          parsed.push(indexRow({
            name: p.name,
            county: p.county ?? "",
            city: p.city ?? "",
            level: p.level ?? "Other",
            charter: p.charter ?? false,
            ela: p.ela ?? null,
            math: p.math ?? null,
            graduationRate: p.graduationRate ?? null,
            rating: p.rating ?? null,
          }));
        }
        setRows(parsed);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Failed to load data");
      });
    return () => { cancelled = true; };
  }, [open, dataUrl]);

  const filtered = useMemo(() => {
    let result = rows;
    if (levelFilter !== "all") {
      result = result.filter((r) => r.level === levelFilter);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r._nameLower.includes(q) ||
          r._cityLower.includes(q) ||
          r._countyLower.includes(q),
      );
    }
    return result;
  }, [rows, levelFilter, debouncedSearch]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sortKey === "name" || sortKey === "county" || sortKey === "city" || sortKey === "level") {
        const av = a[sortKey];
        const bv = b[sortKey];
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const av = a[sortKey] ?? -9999;
      const bv = b[sortKey] ?? -9999;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  // Virtualization: compute visible window
  const totalHeight = sorted.length * ROW_HEIGHT;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(sorted.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  const visibleRows = sorted.slice(startIdx, endIdx);
  const offsetTop = startIdx * ROW_HEIGHT;

  const onScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollTop(scrollRef.current.scrollTop);
    }
  }, []);

  // Measure viewport height on mount and resize
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    setViewportHeight(el.clientHeight);
    return () => ro.disconnect();
  }, [open]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "county" || key === "city" || key === "level" ? "asc" : "desc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return null;
    return sortDir === "asc" ? " \u25B2" : " \u25BC";
  }

  const thBase =
    "sticky top-0 bg-gray-50 px-2 py-2 text-left text-[11px] font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap border-b border-gray-200 z-10";
  const tdBase = "px-2 py-1.5 text-sm tabular-nums";

  const levelFilterIds = Object.keys(SCHOOL_LEVEL_LABELS) as SchoolLevelFilter[];

  return (
    <LegalModal open={open} onClose={onClose} title="School Locations (CDE 2025)" wide>
      <div className="border-b border-gray-200 px-5 py-2.5 flex items-center gap-3 bg-white flex-shrink-0 flex-wrap">
        <div className="inline-flex rounded-md border border-gray-200 text-xs font-medium overflow-hidden">
          {levelFilterIds.map((id) => (
            <button
              key={id}
              onClick={() => setLevelFilter(id)}
              className={`px-3 py-1.5 transition-colors ${id !== "all" ? "border-l border-gray-200" : ""} ${levelFilter === id ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              {SCHOOL_LEVEL_LABELS[id]}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[140px] max-w-[260px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search school, city, county..."
            className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-xs text-gray-700 focus:border-black focus:ring-1 focus:ring-black focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          )}
        </div>
        <span className="text-xs text-gray-500">
          Total: <strong className="text-gray-700">{filtered.length.toLocaleString()}</strong> schools
        </span>
      </div>
      <div ref={scrollRef} onScroll={onScroll} className="overflow-auto flex-1 min-h-0">
        <table className="w-full border-collapse text-sm table-fixed">
          <colgroup>
            <col className="w-10" />
            <col className="w-[200px]" />
            <col className="w-[120px]" />
            <col className="w-[110px]" />
            <col className="w-[80px]" />
            <col className="w-[70px]" />
            <col className="w-[70px]" />
            <col className="w-[70px]" />
            <col className="w-[70px]" />
          </colgroup>
          <thead>
            <tr>
              <th className={`${thBase} text-center sticky left-0 z-20 bg-gray-50`}>#</th>
              <th
                className={`${thBase} sticky left-10 z-20 bg-gray-50 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]`}
                onClick={() => toggleSort("name")}
              >
                School{sortIndicator("name")}
              </th>
              <th className={thBase} onClick={() => toggleSort("city")}>
                City{sortIndicator("city")}
              </th>
              <th className={thBase} onClick={() => toggleSort("county")}>
                County{sortIndicator("county")}
              </th>
              <th className={thBase} onClick={() => toggleSort("level")}>
                Level{sortIndicator("level")}
              </th>
              {METRIC_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`${thBase} text-right`}
                  onClick={() => toggleSort(col.key)}
                  title={col.title}
                >
                  {col.short}{sortIndicator(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Top spacer for virtualization */}
            {offsetTop > 0 && (
              <tr aria-hidden="true"><td colSpan={9} style={{ height: offsetTop, padding: 0, border: "none" }} /></tr>
            )}
            {visibleRows.map((row, vi) => {
              const i = startIdx + vi;
              return (
                <tr
                  key={`${row.name}-${row.city}-${i}`}
                  className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                  style={{ height: ROW_HEIGHT }}
                >
                  <td className={`${tdBase} text-center text-xs text-gray-400 sticky left-0 z-[5] ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                    {i + 1}
                  </td>
                  <td className={`${tdBase} text-left font-medium text-gray-900 sticky left-10 z-[5] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] overflow-hidden text-ellipsis ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`} title={row.name}>
                    {onSelectSchool ? (
                      <button
                        onClick={() => { onSelectSchool(row.name); onClose(); }}
                        className="text-left text-blue-600 hover:text-blue-800 hover:underline truncate block w-full"
                      >
                        {row.name}
                      </button>
                    ) : (
                      <span className="truncate block">{row.name}</span>
                    )}
                  </td>
                  <td className={`${tdBase} text-left`}>
                    {onSelectCity ? (
                      <button
                        onClick={() => { onSelectCity(row.city); onClose(); }}
                        className="text-left text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {row.city}
                      </button>
                    ) : (
                      row.city
                    )}
                  </td>
                  <td className={`${tdBase} text-left`}>
                    {onSelectCounty ? (
                      <button
                        onClick={() => { onSelectCounty(row.county); onClose(); }}
                        className="text-left text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {row.county}
                      </button>
                    ) : (
                      row.county
                    )}
                  </td>
                  <td className={`${tdBase} text-left text-xs text-gray-500`}>
                    {row.level}{row.charter ? " ★" : ""}
                  </td>
                  {METRIC_COLUMNS.map((col) => {
                    const val = row[col.key] as number | null;
                    return (
                      <td
                        key={col.key}
                        className={`${tdBase} text-right ${col.key === sortKey ? "bg-amber-50 font-medium" : "text-gray-600"}`}
                      >
                        {col.key === "rating" && val != null ? (
                          <span className="inline-flex items-center gap-1">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: RATING_COLORS[val] ?? "#9ca3af" }}
                            />
                            {val}
                          </span>
                        ) : (
                          formatVal(val, col.key)
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* Bottom spacer for virtualization */}
            {endIdx < sorted.length && (
              <tr aria-hidden="true"><td colSpan={9} style={{ height: (sorted.length - endIdx) * ROW_HEIGHT, padding: 0, border: "none" }} /></tr>
            )}
          </tbody>
        </table>
        {rows.length === 0 && open && (
          <div className="py-12 text-center text-sm text-gray-400">
            {error ? `Error: ${error}` : "Loading..."}
          </div>
        )}
        {rows.length > 0 && filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">
            No schools match the current filters.
          </div>
        )}
      </div>
    </LegalModal>
  );
}
