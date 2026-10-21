import { cn } from "@/lib/utils";
import { type TaskPriority } from "@/types";

type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger" | "muted";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-soft-accent text-primary",
  primary: "bg-primary text-white",
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  danger: "bg-danger-light text-danger",
  muted: "bg-background text-muted",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Map task priority to badge variant */
export function priorityVariant(p: TaskPriority): BadgeVariant {
  switch (p) {
    case "high":
      return "danger";
    case "medium":
      return "warning";
    case "low":
      return "muted";
  }
}
