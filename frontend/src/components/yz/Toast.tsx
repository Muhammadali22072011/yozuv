"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

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

  const value = useMemo(() => push, [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-16 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto rounded-2xl bg-ink-900 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.2)] animate-fadeIn"
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
