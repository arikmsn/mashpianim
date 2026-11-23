import { cn } from "@/lib/utils";

// Design system v3 (2026-11-23): `pink` keeps its name and gets pink-50 / pink-800 (the old pink-600 text
// fell under 4.5:1). The track tags of the home page (`biz`, `ugc`, `influencer`) and the mandatory
// `demo` tag for non-real data live here too. The dot takes the text colour.
const variantMap = {
  default: "bg-neutral-100 text-neutral-600",
  pink: "bg-pink-50 text-pink-800",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  purple: "bg-tangerine-100 text-tangerine-700",
  biz: "bg-surface-ink text-foreground-on-ink font-semibold",
  ugc: "bg-pink-100 text-pink-800 font-semibold",
  influencer: "bg-lemon-100 text-lemon-900 font-semibold",
  demo: "bg-transparent border border-dashed border-border-strong text-neutral-500",
};

const sizeMap = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1 text-sm",
};

interface BadgeProps {
  variant?: keyof typeof variantMap;
  size?: keyof typeof sizeMap;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

function Badge({
  variant = "default",
  size = "md",
  children,
  className,
  dot = false,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        variantMap[variant],
        sizeMap[size],
        className
      )}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />}
      {children}
    </span>
  );
}

export { Badge, type BadgeProps };
