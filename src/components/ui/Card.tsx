import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
  hover?: boolean;
}

export function Card({
  children,
  className,
  padding = "md",
  hover = false,
}: CardProps) {
  const paddings = {
    sm: "p-3",
    md: "p-4 lg:p-5",
    lg: "p-5 lg:p-6",
  };

  return (
    <div
      className={cn(
        "bg-surface rounded-xl border border-border shadow-card",
        paddings[padding],
        hover && "hover:border-primary/20 hover:shadow-dropdown cursor-pointer",
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
        <h2 className="font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-sm text-muted mt-0.5">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
