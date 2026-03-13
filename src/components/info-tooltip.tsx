import { type ReactNode, useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface InfoTooltipProps {
  children: ReactNode;
}

export default function InfoTooltip({ children }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  const updatePos = useCallback(() => {
    if (!iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();
    setPos({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  }, []);

  const visible = open || hover;

  useEffect(() => {
    if (!visible) return;
    updatePos();
  }, [visible, updatePos]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        iconRef.current?.contains(e.target as Node) ||
        tooltipRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    }
    document.addEventListener("click", handleClickOutside, true);
    return () => document.removeEventListener("click", handleClickOutside, true);
  }, [open]);

  return (
    <>
      <span
        ref={iconRef}
        onClick={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-gray-400 text-[10px] font-semibold text-gray-500 hover:border-gray-600 hover:text-black hover:bg-gray-100 transition-colors"
      >
        i
      </span>
      {visible && pos && createPortal(
        <span
          ref={tooltipRef}
          className="fixed z-[9999] w-64 -translate-x-1/2 -translate-y-full rounded-lg bg-gray-900 px-3 py-2 text-xs text-gray-200 shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          {children}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>,
        document.body
      )}
    </>
  );
}
