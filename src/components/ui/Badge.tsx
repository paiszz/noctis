import { cn } from "@/lib/utils";
import { type TaskPriority } from "@/types";

type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger" | "muted" | "purple";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-soft-accent text-primary",
  primary: "bg-primary text-white",
  purple: "bg-primary/10 text-primary",
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  danger: "bg-danger-light text-danger",
  muted: "bg-[#F3F4F6] text-muted-dark",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-tight",
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
      return "purple";
  }
}
