"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Design package v3 (docs/design-package). `primary` is the business pink, `creator` is lemon with dark
// text (never white on lemon), `persona` follows the nearest [data-persona] container. Fills only, no
// coloured shadows. `outline-light` is the repo's addition for outline buttons on the dark sections.
const variants = {
  primary:
    "bg-primary text-white hover:bg-primary-hover",
  secondary:
    "bg-pink-50 text-pink-800 hover:bg-pink-100",
  creator: "bg-lemon-400 text-ink-900 hover:bg-lemon-300",
  persona: "bg-persona text-persona-fg hover:opacity-90",
  outline:
    "border-2 border-border-strong text-ink-900 hover:border-ink-900",
  "outline-light":
    "border-2 border-white/40 text-on-ink hover:border-on-ink",
  ghost:
    "text-neutral-600 hover:bg-neutral-100",
  dark:
    "bg-surface-ink text-on-ink hover:opacity-90",
  danger:
    "bg-danger text-white hover:opacity-90",
} as const;

const sizes = {
  sm: "px-4 py-2 text-sm rounded-lg",
  md: "px-6 py-3 text-base rounded-xl",
  lg: "px-8 py-3.5 text-lg rounded-xl",
  icon: "p-2.5 rounded-xl",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  fullWidth?: boolean;
  rounded?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      rounded = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-semibold transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          rounded && "!rounded-full",
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export { Button, type ButtonProps };
