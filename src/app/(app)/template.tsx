export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="w-full animate-fade-up">{children}</div>;
}
