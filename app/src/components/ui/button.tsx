"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Design system v3 (2026-11-23). Two persona colours: `primary` is pink for businesses, `creator` is lemon
// for content creators (dark text on lemon, never white). `persona` follows the nearest data-persona
// container. Fills only, no coloured shadows; the focus ring is dark so it reads on pink as well.
const variants = {
  primary:
    "bg-pink-600 text-white hover:bg-pink-700 active:bg-pink-700",
  creator:
    "bg-lemon-400 text-ink-900 hover:bg-lemon-300 active:bg-lemon-300",
  persona:
    "bg-persona text-persona-foreground hover:bg-persona-hover active:bg-persona-hover",
  secondary:
    "bg-pink-50 text-pink-800 hover:bg-pink-100",
  outline:
    "border-2 border-border-strong bg-transparent text-ink-900 hover:border-ink-900",
  "outline-light":
    "border-2 border-white/40 bg-transparent text-foreground-on-ink hover:border-foreground-on-ink",
  ghost:
    "text-neutral-600 hover:bg-neutral-100",
  dark:
    "bg-surface-ink text-foreground-on-ink hover:bg-ink-700",
  danger:
    "bg-red-500 text-white hover:bg-red-600",
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
          "inline-flex items-center justify-center gap-2 font-bold transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
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
