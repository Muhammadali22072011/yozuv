import { Bell, CalendarClock, LineChart, QrCode, ShieldCheck, Users } from "lucide-react";

const items = [
  {
    icon: CalendarClock,
    title: "Slotlar avtomatik",
    desc: "Ish vaqti, tanaffus va band vaqtlar hisobga olinadi.",
    bg: "#EEF0FF",
    fg: "#4853F5",
  },
  {
    icon: Bell,
    title: "Eslatmalar",
    desc: "1 soat oldin mijozga Telegram orqali eslatma.",
    bg: "#FFF3DA",
    fg: "#A8751A",
  },
  {
    icon: Users,
    title: "Mijozlar bazasi",
    desc: "Takroriy tashriflar va tarix — bitta joyda.",
    bg: "#E6FAF3",
    fg: "#0E9577",
  },
  {
    icon: LineChart,
    title: "Analitika",
    desc: "Daromad, mashhur xizmatlar va bandlik.",
    bg: "#FFE7E3",
    fg: "#FF7A6B",
  },
  {
    icon: QrCode,
    title: "QR va PDF",
    desc: "Biznes uchun tayyor broshyura.",
    bg: "#EEF0FF",
    fg: "#4853F5",
  },
  {
    icon: ShieldCheck,
    title: "To‘lovlar",
    desc: "Payme va Click orqali obuna to‘lovi.",
    bg: "#E6FAF3",
    fg: "#22C8A8",
  },
];

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="max-w-2xl">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">
          Imkoniyatlar
        </div>
        <h2 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-4xl">
          Kundalik jarayonlarni soddalashtiring
        </h2>
        <p className="mt-3 text-ink-500">
          Mijoz oqimi, eslatmalar va tahlildan vaqt ayirmang — Yozuv o‘zi qiladi.
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <div key={it.title} className="card-soft p-6">
            <div
              className="grid h-11 w-11 place-items-center rounded-xl"
              style={{ background: it.bg, color: it.fg }}
            >
              <it.icon className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-ink-900">
              {it.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{it.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
