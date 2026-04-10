import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LegalModal from "@/components/legal-modal";
import { LuSearch, LuChevronRight } from "react-icons/lu";
import { fetchJsonCached } from "@/utils/fetch-json";
import type { PlaceType } from "@/utils/place-slugs";

const DATA_URLS: Record<PlaceType, string> = {
  county: `${import.meta.env.BASE_URL}data/california-county-labels.geojson`,
  city: `${import.meta.env.BASE_URL}data/california-city-labels.geojson`,
};

export interface PlaceBrowseModalProps {
  open: boolean;
  onClose: () => void;
  browseType: PlaceType;
  onTypeChange: (type: PlaceType) => void;
  onSelectPlace: (type: PlaceType, name: string) => void;
}

export default function PlaceBrowseModal({
  open,
  onClose,
  browseType,
  onTypeChange,
  onSelectPlace,
}: PlaceBrowseModalProps) {
  const [allNames, setAllNames] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const dataUrl = DATA_URLS[browseType];

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchJsonCached(dataUrl)
      .then((geo: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const names: string[] = geo.features
          .map((f: { properties: { name: string } }) => f.properties.name)
          .filter(Boolean)
          .sort((a: string, b: string) => a.localeCompare(b));
        setAllNames(names);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [open, dataUrl]);

  // Focus search on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleTypeSwitch = useCallback((type: PlaceType) => {
    if (type !== browseType) {
      onTypeChange(type);
      setQuery("");
    }
  }, [browseType, onTypeChange]);

  const lowerQuery = query.toLowerCase().trim();
  const filtered = useMemo(() => {
    if (!lowerQuery) return allNames;
    return allNames.filter((n) => n.toLowerCase().includes(lowerQuery));
  }, [allNames, lowerQuery]);

  const handleSelect = useCallback((name: string) => {
    onSelectPlace(browseType, name);
  }, [browseType, onSelectPlace]);

  if (!open) return null;

  const typeLabel = browseType === "county" ? "Counties" : "Cities";

  return (
    <LegalModal
      open={open}
      onClose={onClose}
      title={`CaliVibe: California ${typeLabel}`}
      wide
      sizeClassName="!max-w-xl !h-[80dvh] !w-[95vw] md:!w-[90vw]"
    >
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50/50">
        {/* Type toggle */}
        <div className="inline-flex rounded-md border border-gray-300 text-xs overflow-hidden">
          <button
            onClick={() => handleTypeSwitch("county")}
            className={`px-2.5 py-1 font-medium transition-colors ${browseType === "county" ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}
          >
            Counties
          </button>
          <button
            onClick={() => handleTypeSwitch("city")}
            className={`px-2.5 py-1 font-medium transition-colors border-l border-gray-300 ${browseType === "city" ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}
          >
            Cities
          </button>
        </div>

        {/* Search */}
        <div className="flex-1 relative">
          <LuSearch className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${browseType === "county" ? "counties" : "cities"}...`}
            className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-7 pr-3 text-[16px] sm:text-xs text-gray-700 placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Results list */}
      <div className="overflow-auto min-h-0 flex-1">
        {loading && <p className="text-center py-8 text-gray-500 text-sm">Loading...</p>}

        {!loading && filtered.length === 0 && (
          <p className="text-center py-8 text-gray-400 text-sm">
            {lowerQuery ? `No ${typeLabel.toLowerCase()} matching "${query}"` : `No ${typeLabel.toLowerCase()} found`}
          </p>
        )}

        {!loading && filtered.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {filtered.map((name) => (
              <li key={name}>
                <button
                  onClick={() => handleSelect(name)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer text-left"
                >
                  <span>
                    {lowerQuery ? <HighlightMatch text={name} query={lowerQuery} /> : name}
                    {browseType === "county" && <span className="text-gray-400 ml-1">County</span>}
                  </span>
                  <LuChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-gray-100 px-3 py-1.5 text-center text-[10px] text-gray-400">
        {filtered.length} {typeLabel.toLowerCase()}
      </div>
    </LegalModal>
  );
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const lowerText = text.toLowerCase();
  const matchIndex = lowerText.indexOf(query);
  if (matchIndex === -1) return <>{text}</>;
  const before = text.slice(0, matchIndex);
  const match = text.slice(matchIndex, matchIndex + query.length);
  const after = text.slice(matchIndex + query.length);
  return <>{before}<span className="font-bold text-black">{match}</span>{after}</>;
}
