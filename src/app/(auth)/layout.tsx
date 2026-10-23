import type { Metadata } from "next";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Autentikasi",
  description: "Masuk atau daftar ke akun Noctis.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">{children}</div>
      <Toaster position="bottom-right" richColors theme="light" />
    </div>
  );
}
