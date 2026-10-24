export default function AuthTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="w-full animate-fade-up">{children}</div>;
}
