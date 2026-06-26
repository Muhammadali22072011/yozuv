"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TabBar } from "@/components/yz/TabBar";
import { NewBookingSheet } from "@/components/yz/NewBookingSheet";
import { ToastProvider } from "@/components/yz/Toast";
import { cn } from "@/lib/utils";

// Form / single-purpose pages read best as a centered column even on a
// big monitor — stretching their inputs to 1200px hurts. List & overview
// pages (home, bookings, clients…) get the full desktop canvas instead.
const NARROW_ROUTES = [
  "/dashboard/settings",
  "/dashboard/profile",
  "/dashboard/schedule",
  "/dashboard/qr",
  "/dashboard/security",
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname?.startsWith("/dashboard/onboarding");
  const narrow = NARROW_ROUTES.some((r) => pathname?.startsWith(r));
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
          <div
            className={cn(
              "mx-auto w-full max-w-md px-4 pb-4 md:max-w-3xl md:px-8 md:pt-8",
              narrow
                ? "lg:max-w-2xl"
                : "lg:max-w-5xl xl:max-w-6xl 2xl:max-w-[1280px]"
            )}
          >
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
