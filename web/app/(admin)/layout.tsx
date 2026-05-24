import { AppProviders } from "@/components/AppProviders";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProviders>
      <div className="min-h-screen bg-[var(--background)]">{children}</div>
    </AppProviders>
  );
}
