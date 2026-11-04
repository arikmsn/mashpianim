"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const sizeMap = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-base",
  lg: "w-14 h-14 text-lg",
  xl: "w-20 h-20 text-2xl",
};

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: keyof typeof sizeMap;
  className?: string;
  expandable?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
}

const colors = [
  "bg-pink-100 text-pink-600",
  "bg-purple-100 text-purple-600",
  "bg-blue-100 text-blue-600",
  "bg-emerald-100 text-emerald-600",
  "bg-amber-100 text-amber-600",
  "bg-rose-100 text-rose-600",
];

function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 left-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        aria-label="סגור"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      {alt && <p className="absolute bottom-6 text-white/80 text-sm">{alt}</p>}
    </div>
  );
}

function Avatar({ src, name = "", size = "md", className, expandable = false }: AvatarProps) {
  const [open, setOpen] = useState(false);

  if (src) {
    const img = (
      <img
        src={src}
        alt={name}
        className={cn(
          "rounded-full object-cover ring-2 ring-white",
          sizeMap[size],
          expandable && "cursor-zoom-in hover:ring-pink-300 transition-all",
          className
        )}
      />
    );
    if (!expandable) return img;
    return (
      <>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className="rounded-full shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
          aria-label={`הגדלת תמונה של ${name}`}
        >
          {img}
        </button>
        {open && <ImageLightbox src={src} alt={name} onClose={() => setOpen(false)} />}
      </>
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-medium ring-2 ring-white",
        sizeMap[size],
        colorFromName(name),
        className
      )}
    >
      {getInitials(name) || "?"}
    </div>
  );
}

export { Avatar, ImageLightbox, type AvatarProps };
