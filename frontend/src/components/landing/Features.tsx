import { Bell, CalendarClock, LineChart, QrCode, ShieldCheck, Users } from "lucide-react";

const items = [
  { icon: CalendarClock, title: "Slotlar avtomatik", desc: "Ish vaqti, tanaffus va band vaqtlar hisobga olinadi." },
  { icon: Bell, title: "Eslatmalar", desc: "1 soat oldin mijozga Telegram orqali eslatma." },
  { icon: Users, title: "Mijozlar bazasi", desc: "Takroriy tashriflar va tarix — bitta joyda." },
  { icon: LineChart, title: "Analitika", desc: "Daromad, mashhur xizmatlar va bandlik." },
  { icon: QrCode, title: "QR va PDF", desc: "Biznes uchun tayyor materiallar." },
  { icon: ShieldCheck, title: "To‘lovlar", desc: "Payme va Click orqali obuna to‘lovi (PayTechUZ)." },
];

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <h2 className="font-serif text-3xl text-ink md:text-4xl">Imkoniyatlar</h2>
      <p className="mt-3 max-w-2xl text-ink/70">Yozuv bilan kundalik jarayonlarni soddalashtiring.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <div key={it.title} className="rounded-2xl border border-ink/10 bg-white p-6">
            <it.icon className="h-6 w-6 text-brand" />
            <h3 className="mt-4 font-serif text-xl">{it.title}</h3>
            <p className="mt-2 text-sm text-ink/70">{it.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
