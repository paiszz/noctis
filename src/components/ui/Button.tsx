import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline" | "white";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-dark active:scale-[0.98] shadow-sm hover:shadow-glow",
  secondary:
    "bg-soft-accent text-primary hover:bg-soft-accent/80 active:scale-[0.98]",
  danger:
    "bg-danger text-white hover:bg-danger/90 active:scale-[0.98]",
  ghost:
    "text-muted-dark hover:bg-soft-accent/60 hover:text-foreground",
  outline:
    "bg-surface text-foreground border border-border hover:bg-soft-accent/40 hover:border-primary/40",
  white:
    "bg-white text-primary hover:bg-white/95 active:scale-[0.98] shadow-sm",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "text-xs px-3 py-1.5 rounded-full gap-1.5 font-medium",
  md: "text-sm px-4 py-2 rounded-full gap-2 font-medium",
  lg: "text-base px-6 py-2.5 rounded-full gap-2.5 font-semibold",
  icon: "p-2 rounded-full",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer",
        "disabled:opacity-50 disabled:pointer-events-none",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
