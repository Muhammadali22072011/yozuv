"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname?.startsWith("/dashboard/onboarding");

  if (bare) {
    return <div className="min-h-screen bg-paper">{children}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper md:flex-row">
      <Sidebar />
      <div className="flex-1">
        <div className="hidden border-b border-ink/10 bg-white px-6 py-5 md:block">
          <h1 className="font-serif text-2xl text-ink">Kabinet</h1>
        </div>
        <div className="p-4 md:p-6">{children}</div>
      </div>
    </div>
  );
}
