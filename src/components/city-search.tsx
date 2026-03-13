import { useCallback, useEffect, useRef, useState } from "react";
import { LuSearch } from "react-icons/lu";
import { fetchJsonCached } from "@/utils/fetch-json";

interface GeoSearchProps {
  dataUrl: string;
  placeholder?: string;
  onSelect: (name: string) => void;
}

export default function GeoSearch({ dataUrl, placeholder = "Search...", onSelect }: GeoSearchProps) {
  const [query, setQuery] = useState("");
  const [names, setNames] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Load names once
  useEffect(() => {
    fetchJsonCached(dataUrl)
      .then((geojson: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const loaded: string[] = geojson.features
          .map((f: { properties: { name: string } }) => f.properties.name)
          .filter(Boolean)
          .sort((a: string, b: string) => a.localeCompare(b));
        setNames(loaded);
      });
  }, [dataUrl]);

  // Filter suggestions
  const lowerQuery = query.toLowerCase().trim();
  const suggestions =
    lowerQuery.length > 0
      ? names.filter((name) => name.toLowerCase().includes(lowerQuery)).slice(0, 8)
      : [];

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const selectItem = useCallback(
    (name: string) => {
      setQuery("");
      setIsOpen(false);
      setActiveIndex(-1);
      onSelect(name);
    },
    [onSelect]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "ArrowDown" && suggestions.length > 0) {
        setIsOpen(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          selectItem(suggestions[activeIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setIsOpen(true);
    setActiveIndex(-1);
  }

  return (
    <div ref={containerRef} className="relative mt-2 ml-14">
      <div className="relative">
        <LuSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => query.trim() && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm text-gray-700 placeholder:text-gray-400 shadow-sm focus:border-black focus:ring-1 focus:ring-black focus:outline-none transition-colors"
        />
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-20 mt-1 w-full max-h-52 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((name, index) => (
            <li
              key={name}
              onMouseDown={(e) => {
                e.preventDefault();
                selectItem(name);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`cursor-pointer px-3 py-1.5 text-sm transition-colors ${
                index === activeIndex ? "bg-gray-100 text-black" : "text-gray-700"
              }`}
            >
              <HighlightMatch text={name} query={lowerQuery} />
            </li>
          ))}
        </ul>
      )}
    </div>
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

  return (
    <>
      {before}
      <span className="font-bold text-black">{match}</span>
      {after}
    </>
  );
}
