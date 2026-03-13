import { useEffect, useRef, type ReactNode } from "react";

interface LegalModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  wide?: boolean;
  children: ReactNode;
}

export default function LegalModal({ open, onClose, title, wide, children }: LegalModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
      className={`fixed inset-0 z-50 m-auto w-[90vw] rounded-xl bg-white p-0 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm ${wide ? "max-w-4xl h-[80vh] h-[80dvh] open:flex open:flex-col" : "max-w-lg max-h-[80vh] max-h-[80dvh]"}`}
    >
      <div className={`flex items-center justify-between border-b border-gray-200 px-5 py-3 ${wide ? "" : "sticky top-0 bg-white rounded-t-xl z-10"}`}>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div className={`text-sm text-gray-700 leading-relaxed ${wide ? "min-h-0 flex-1 flex flex-col" : "overflow-y-auto px-5 py-4"}`}>
        {children}
      </div>
    </dialog>
  );
}
