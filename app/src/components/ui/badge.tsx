import { cn } from "@/lib/utils";

// Design package v3 (docs/design-package): `pink` keeps its name with pink-50 / pink-800 (the old
// pink-600 text fell under 4.5:1); `ugc` / `influencer` / `business` are the home page track tags and
// `demo` is mandatory on any interface that shows non-real data.
const variantMap = {
  default: "bg-neutral-100 text-neutral-600",
  pink: "bg-pink-50 text-pink-800",
  ugc: "bg-pink-100 text-pink-800 font-semibold",
  influencer: "bg-lemon-100 text-lemon-900 font-semibold",
  business: "bg-surface-ink text-on-ink font-semibold",
  demo: "border border-dashed border-border-strong text-neutral-500",
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-red-50 text-red-600",
  info: "bg-blue-50 text-blue-600",
  purple: "bg-purple-50 text-purple-600",
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
      {dot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full", {
            "bg-neutral-400": variant === "default",
            "bg-pink-600": variant === "pink",
            "bg-emerald-500": variant === "success",
            "bg-amber-500": variant === "warning",
            "bg-red-500": variant === "danger",
            "bg-blue-500": variant === "info",
            "bg-purple-500": variant === "purple",
          })}
        />
      )}
      {children}
    </span>
  );
}

export { Badge, type BadgeProps };
