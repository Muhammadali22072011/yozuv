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
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink-900/45 animate-fadeIn data-[state=closed]:animate-[fadeIn_200ms_ease_reverse]" />
      <DialogPrimitive.Content
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 flex max-h-[92vh] flex-col rounded-t-[28px] bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.12)] animate-sheetUp focus:outline-none",
          "mx-auto md:max-w-[480px]",
          className
        )}
        style={{ height: resolvedHeight, maxHeight: "92vh" }}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-ink-200" />
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
    <div className="flex items-center justify-between px-5 pt-4">
      {title ? (
        <h2 className="font-display text-[22px] font-extrabold tracking-tight text-ink-900">
          {title}
        </h2>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        {right}
        <DialogPrimitive.Close
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-xl bg-ink-100 text-ink-900 tap"
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
      className={cn("flex items-center gap-2.5 px-5 pt-3", className)}
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
    >
      {children}
    </div>
  );
}
