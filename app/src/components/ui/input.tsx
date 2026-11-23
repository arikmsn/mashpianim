"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

// Design system v3 (2026-11-23): warm border-strong at rest, a dark double ring on focus (not pink, so a
// focused field is never confused with an erroneous one), danger border + soft fill on error. 16px text so
// iOS does not zoom. The icon sits on the right, which is the start in RTL.
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, id, ...props }, ref) => {
    const inputId = id || label?.replace(/\s+/g, "-").toLowerCase();
    const errorId = error && inputId ? `${inputId}-error` : undefined;
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-semibold mb-2 text-neutral-700"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            className={cn(
              "w-full px-4 py-3 rounded-xl border bg-surface text-base text-ink-900 outline-none transition-colors duration-150",
              "placeholder:text-neutral-400",
              "focus:border-ink-900 focus:ring-2 focus:ring-focus-ring focus:ring-offset-2 focus:ring-offset-surface",
              error
                ? "border-danger bg-danger-soft focus:border-danger focus:ring-danger"
                : "border-border-strong",
              icon && "pr-10",
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p id={errorId} className="mt-1.5 text-xs text-danger">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export { Input, type InputProps };
