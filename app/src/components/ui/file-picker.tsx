"use client";

import { useId, useRef } from "react";
import { cn } from "@/lib/utils";

interface FilePickerProps {
  accept?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  // Button label when nothing is chosen / when something is chosen
  label?: string;
  changeLabel?: string;
  disabled?: boolean;
  className?: string;
}

function formatSize(bytes: number) {
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Hebrew file control: the native input (with its English "Choose File / No file chosen") stays hidden
export function FilePicker({ accept, file, onChange, label = "בחירת קובץ", changeLabel = "החלפת קובץ", disabled, className }: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          onChange(e.target.files?.[0] || null);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="shrink-0 px-4 py-2 rounded-xl bg-pink-50 text-pink-600 text-sm font-medium hover:bg-pink-100 transition-colors disabled:opacity-50"
      >
        {file ? changeLabel : label}
      </button>
      <div className="min-w-0 flex-1 text-xs text-neutral-500">
        {file ? (
          <span className="flex items-center gap-2 min-w-0">
            <span className="truncate" dir="ltr">{file.name}</span>
            <span className="shrink-0 text-neutral-400">({formatSize(file.size)})</span>
            <button type="button" onClick={() => onChange(null)} className="shrink-0 text-neutral-400 hover:text-red-500" aria-label="הסרת הקובץ">
              ✕
            </button>
          </span>
        ) : (
          <span className="text-neutral-400">לא נבחר קובץ</span>
        )}
      </div>
    </div>
  );
}
