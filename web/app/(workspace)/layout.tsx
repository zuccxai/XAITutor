import WorkspaceSidebar from "@/components/sidebar/WorkspaceSidebar";
import { AppProviders } from "@/components/AppProviders";
import { UnifiedChatProvider } from "@/context/UnifiedChatContext";

export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppProviders>
      <UnifiedChatProvider>
        <div className="flex h-screen overflow-hidden">
          <WorkspaceSidebar />
          <main className="flex-1 overflow-hidden bg-[var(--background)]">
            {children}
          </main>
        </div>
      </UnifiedChatProvider>
    </AppProviders>
  );
}
