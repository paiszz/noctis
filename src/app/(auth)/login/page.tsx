import Link from "next/link";
import { Card } from "@/components/ui";

export default function LoginPage() {
  return (
    <div className="space-y-6">
      {/* Logo */}
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-bold text-2xl">N</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Noctis</h1>
        <p className="text-sm text-muted mt-1">
          Your Personal Productivity Space
        </p>
      </div>

      {/* Login form placeholder */}
      <Card>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="email@example.com"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg
                text-foreground placeholder:text-muted
                focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg
                text-foreground placeholder:text-muted
                focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus"
            />
          </div>
          <Link
            href="/dashboard"
            className="block w-full text-center bg-primary text-white py-2.5 rounded-lg font-medium text-sm hover:bg-primary-dark transition-colors"
          >
            Masuk
          </Link>
          <p className="text-xs text-center text-muted">
            Autentikasi akan berfungsi setelah integrasi Supabase Auth.
          </p>
        </div>
      </Card>
    </div>
  );
}
