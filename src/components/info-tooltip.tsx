import { type ReactNode } from "react";

interface InfoTooltipProps {
  children: ReactNode;
}

export default function InfoTooltip({ children }: InfoTooltipProps) {
  return (
    <span className="group relative ml-1 inline-flex">
      <span className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-gray-400 text-[10px] font-semibold text-gray-500 hover:border-gray-600 hover:text-black hover:bg-gray-100 transition-colors">
        i
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-64 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs text-gray-200 shadow-lg group-hover:pointer-events-auto group-hover:block">
        {children}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  );
}
