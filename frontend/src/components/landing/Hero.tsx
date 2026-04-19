import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-ink/10 bg-gradient-to-b from-cream to-paper">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-20 lg:flex-row lg:items-center">
        <div className="flex-1 space-y-6">
          <Logo size={36} />
          <p className="text-sm uppercase tracking-[0.2em] text-ink/60">Telegram Mini App</p>
          <h1 className="font-serif text-5xl leading-[1.05] text-ink md:text-6xl">
            Yozuv — mijozlar Telegram orqali yoziladi
          </h1>
          <p className="max-w-xl text-lg text-ink/70">
            Barbershop, salon, klinika va boshqa xizmatlar uchun slotlar, eslatmalar va analitika — bitta
            platformada.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/auth/login">Boshlash</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/dashboard">Demo dashboard</Link>
            </Button>
          </div>
        </div>
        <div className="flex-1">
          <div className="rounded-2xl border border-ink/10 bg-white p-4 shadow-xl">
            <div className="rounded-xl bg-cream p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Bugungi yozilishlar</p>
              <div className="mt-4 space-y-3">
                {["14:00 — Soch olish", "15:30 — Sartarosh", "17:00 — Ustara"].map((row) => (
                  <div key={row} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                    <span>{row}</span>
                    <span className="text-brand">tasdiqlangan</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
