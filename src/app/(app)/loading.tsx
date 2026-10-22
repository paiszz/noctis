export default function AppLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
      {/* Greeting skeleton */}
      <div>
        <div className="h-8 w-48 bg-border rounded-lg mb-2" />
        <div className="h-4 w-32 bg-border rounded" />
      </div>

      {/* Next-up skeleton */}
      <div className="h-24 bg-border rounded-xl" />

      {/* Quick actions skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-border rounded-xl" />
        ))}
      </div>

      {/* Cards grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className={`h-48 bg-border rounded-xl ${i === 2 ? "lg:col-span-2" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}
