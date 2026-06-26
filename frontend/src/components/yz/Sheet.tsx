"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const SheetRoot = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetPortal = DialogPrimitive.Portal;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  children,
  className,
  height = "auto",
}: {
  children: React.ReactNode;
  className?: string;
  height?: "auto" | "tall" | string;
}) {
  const resolvedHeight =
    height === "auto" ? "auto" : height === "tall" ? "88vh" : height;
  return (
    <SheetPortal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[2px] animate-fadeIn data-[state=closed]:animate-[fadeIn_200ms_ease_reverse]" />
      <DialogPrimitive.Content
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 flex max-h-[92vh] flex-col rounded-t-4xl bg-white shadow-[0_-10px_50px_-12px_rgba(11,15,31,0.25)] animate-sheetUp focus:outline-none",
          "mx-auto md:max-w-[480px]",
          className
        )}
        style={{ height: resolvedHeight, maxHeight: "92vh" }}
      >
        <div className="mx-auto mt-3 h-1.5 w-11 shrink-0 rounded-full bg-ink-200/80" />
        {children}
      </DialogPrimitive.Content>
    </SheetPortal>
  );
}

export function SheetHeader({
  title,
  onClose,
  right,
}: {
  title?: string;
  onClose?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-4">
      {title ? (
        <h2 className="min-w-0 truncate font-display text-[22px] font-extrabold tracking-tighter text-ink-900">
          {title}
        </h2>
      ) : (
        <span />
      )}
      <div className="flex shrink-0 items-center gap-2">
        {right}
        <DialogPrimitive.Close
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-2xl bg-ink-100 text-ink-500 tap-icon hover:bg-ink-200/70 hover:text-ink-900"
          aria-label="Yopish"
        >
          <X className="h-5 w-5" strokeWidth={2.2} />
        </DialogPrimitive.Close>
      </div>
    </div>
  );
}

export function SheetBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("scroll flex-1 overflow-y-auto px-5 py-4", className)}>{children}</div>
  );
}

export function SheetFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 border-t border-ink-100/70 px-5 pt-3.5",
        className
      )}
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
    >
      {children}
    </div>
  );
}
