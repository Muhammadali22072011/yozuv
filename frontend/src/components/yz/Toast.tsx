"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";

type Toast = { id: number; text: string };

const Ctx = createContext<(text: string) => void>(() => {});

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setItems((p) => [...p, { id, text }]);
    setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 2400);
  }, []);

  useEffect(() => {
    // Back-compat with prototype helper
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__yzToast = push;
  }, [push]);

  const value = useMemo(() => push, [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-16 z-[100] flex w-full max-w-[90vw] -translate-x-1/2 flex-col items-center gap-2.5 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className="yz-dark pointer-events-auto flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-soft-lg ring-1 ring-white/10 animate-pop-in"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15">
              <CheckCircle2 className="h-4 w-4 text-white" strokeWidth={2.5} />
            </span>
            <span className="leading-snug">{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
