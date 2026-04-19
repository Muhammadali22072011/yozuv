import Link from "next/link";
import { Button } from "@/components/ui/button";

const tiers = [
  { name: "Trial", price: "0", note: "14 kun", cta: "Boshlash", href: "/auth/register" },
  { name: "Oylik", price: "$15", note: "187 500 so‘m", cta: "To‘lash", href: "/dashboard/settings" },
  { name: "Yillik", price: "$150", note: "1 875 000 so‘m", cta: "To‘lash", href: "/dashboard/settings" },
];

export function Pricing() {
  return (
    <section className="border-t border-ink/10 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-serif text-3xl text-ink md:text-4xl">Tariflar</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div key={t.name} className="rounded-2xl border border-ink/10 bg-paper p-6">
              <h3 className="font-serif text-2xl">{t.name}</h3>
              <p className="mt-4 text-4xl font-semibold text-ink">{t.price}</p>
              <p className="mt-2 text-sm text-ink/60">{t.note}</p>
              <Button asChild className="mt-6 w-full">
                <Link href={t.href}>{t.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
