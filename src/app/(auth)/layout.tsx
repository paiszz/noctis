import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Masuk ke akun Noctis.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
