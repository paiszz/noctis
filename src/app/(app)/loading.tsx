export default function AppLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Memuat konten">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="h-8 sm:h-9 w-48 sm:w-64 bg-muted/25 rounded-2xl mb-2" />
          <div className="h-4 w-60 sm:w-80 bg-muted/15 rounded-lg" />
        </div>
        <div className="h-9 w-32 bg-muted/20 rounded-full shrink-0" />
      </div>

      {/* Filter / Search Bar skeleton */}
      <div className="h-11 w-full bg-surface/80 rounded-2xl border border-border/70 shadow-card" />

      {/* Content list / cards skeleton */}
      <div className="space-y-3.5">
        <div className="h-24 bg-surface/80 rounded-2xl lg:rounded-3xl border border-border/70 shadow-card" />
        <div className="h-24 bg-surface/80 rounded-2xl lg:rounded-3xl border border-border/70 shadow-card" />
        <div className="h-24 bg-surface/80 rounded-2xl lg:rounded-3xl border border-border/70 shadow-card" />
        <div className="h-24 bg-surface/80 rounded-2xl lg:rounded-3xl border border-border/70 shadow-card" />
      </div>
    </div>
  );
}
