import { Navbar, MobileNav } from "@/components/layout";
import { DataProvider } from "@/lib/data-context";
import { Toaster } from "sonner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <div className="min-h-screen flex flex-col">
        {/* Top Floating Navbar */}
        <Navbar />

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8 pb-28 lg:pb-12">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileNav />

        {/* Sonner Toast Notification */}
        <Toaster position="bottom-right" richColors theme="light" />
      </div>
    </DataProvider>
  );
}

