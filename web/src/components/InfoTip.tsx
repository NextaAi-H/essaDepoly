import { useState } from "react";

// Small ⓘ icon that reveals an explanation on hover/focus.
export default function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label="More info"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="h-4 w-4 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold grid place-items-center hover:bg-brand hover:text-white transition-colors"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-20 left-1/2 -translate-x-1/2 top-6 w-56 rounded-lg bg-slate-800 text-white text-xs leading-snug p-2.5 shadow-lg"
        >
          {text}
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-slate-800" />
        </span>
      )}
    </span>
  );
}
