"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TabBar } from "@/components/yz/TabBar";
import { NewBookingSheet } from "@/components/yz/NewBookingSheet";
import { ToastProvider } from "@/components/yz/Toast";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname?.startsWith("/dashboard/onboarding");
  const [newBookingOpen, setNewBookingOpen] = useState(false);

  if (bare) {
    return (
      <ToastProvider>
        <div className="min-h-screen bg-ink-50">{children}</div>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col bg-ink-50 md:flex-row">
        <Sidebar onAddBooking={() => setNewBookingOpen(true)} />
        <main className="flex-1 pb-28 md:pb-10 md:pl-0">
          {/* No top padding here — every dashboard page either starts
              with HeroGradient (its own pt-14) or ScreenHeader (its
              own pt-4). A wrapper pt-* would let bg-ink-50 show as a
              light strip between Telegram's chrome and the hero. */}
          <div className="mx-auto w-full max-w-md px-4 pb-4 md:max-w-6xl md:px-8 md:pt-8">
            {children}
          </div>
        </main>
        <TabBar onAdd={() => setNewBookingOpen(true)} />
        <NewBookingSheet
          open={newBookingOpen}
          onOpenChange={setNewBookingOpen}
          onCreated={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("yz:bookings-changed"));
            }
          }}
        />
      </div>
    </ToastProvider>
  );
}
