export default function AppLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="h-9 w-64 bg-white/70 rounded-2xl mb-2" />
          <div className="h-4 w-80 bg-white/50 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-48 bg-white/70 rounded-full" />
          <div className="h-10 w-32 bg-white/70 rounded-full" />
        </div>
      </div>

      {/* 4-column main grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="h-56 bg-white/80 rounded-3xl" />
          <div className="h-40 bg-white/80 rounded-3xl" />
        </div>
        <div className="lg:col-span-4 space-y-5">
          <div className="h-36 bg-white/80 rounded-3xl" />
          <div className="h-80 bg-white/80 rounded-3xl" />
        </div>
        <div className="lg:col-span-3 space-y-5">
          <div className="h-44 bg-white/80 rounded-3xl" />
          <div className="h-72 bg-white/80 rounded-3xl" />
        </div>
        <div className="lg:col-span-3 space-y-5">
          <div className="h-44 bg-primary/30 rounded-3xl" />
          <div className="h-72 bg-white/80 rounded-3xl" />
        </div>
      </div>

      {/* Bottom 2 wide cards skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 h-64 bg-white/80 rounded-3xl" />
        <div className="lg:col-span-5 h-64 bg-white/80 rounded-3xl" />
      </div>
    </div>
  );
}
