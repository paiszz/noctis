import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

export function Card({
  children,
  className,
  padding = "md",
  hover = false,
}: CardProps) {
  const paddings = {
    none: "",
    sm: "p-3 sm:p-4",
    md: "p-4 sm:p-5 lg:p-6",
    lg: "p-6 sm:p-7 lg:p-8",
  };

  return (
    <div
      className={cn(
        "bg-surface rounded-2xl lg:rounded-3xl border border-border/70 shadow-card transition-all duration-200",
        paddings[padding],
        hover && "hover:border-primary/30 hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-4", className)}>
      <div>
        <h2 className="font-semibold text-base sm:text-lg text-foreground tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-xs sm:text-sm text-muted mt-0.5">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
