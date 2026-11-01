import { cn } from "@/lib/utils";

const variantMap = {
  default: "bg-neutral-100 text-neutral-600",
  pink: "bg-pink-50 text-pink-600",
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
            "bg-pink-500": variant === "pink",
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
