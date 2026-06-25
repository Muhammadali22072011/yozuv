import {
  Bell,
  BellRing,
  CalendarClock,
  LineChart,
  QrCode,
  ShieldCheck,
  Users,
} from "lucide-react";

const items = [
  {
    icon: CalendarClock,
    title: "Ikki marta band bo‘lmaydi",
    desc: "Bot ish vaqti, tanaffus va band slotlarni o‘zi hisoblaydi — bitta vaqtga ikki mijoz tushmaydi.",
    bg: "#EEF0FF",
    fg: "#4853F5",
  },
  {
    icon: Bell,
    title: "Neyavkalar kamayadi",
    desc: "Tashrifdan 1 soat oldin bot mijozga Telegramda eslatadi — «esimdan chiqibdi» deyilmaydi.",
    bg: "#FFF3DA",
    fg: "#A8751A",
  },
  {
    icon: Users,
    title: "Har bir mijoz yodda",
    desc: "Tashriflar tarixi, promokodlar va sodiqlik kartasi — har N-tashrif bepul. Mijoz qaytib keladi.",
    bg: "#E6FAF3",
    fg: "#0E9577",
  },
  {
    icon: LineChart,
    title: "Daromadingizni ko‘rasiz",
    desc: "Qaysi xizmat ko‘p daromad keltirdi, qachon band bo‘ldingiz — raqamlar bilan, taxminsiz.",
    bg: "#FFE7E3",
    fg: "#FF7A6B",
  },
  {
    icon: QrCode,
    title: "Yangi mijozlar o‘zi topadi",
    desc: "Shaxsiy sahifa, karta-katalog, QR va tayyor PDF-broshyura — bir bosishda. Mijoz to‘g‘ri botga tushadi.",
    bg: "#EEF0FF",
    fg: "#4853F5",
  },
  {
    icon: ShieldCheck,
    title: "Sumda, oson to‘lov",
    desc: "Obunani Payme yoki Click orqali to‘laysiz — chet el kartasi kerak emas.",
    bg: "#E6FAF3",
    fg: "#22C8A8",
  },
  {
    icon: BellRing,
    title: "Bo‘sh slot bekorga ketmaydi",
    desc: "Mijoz bekor qilsa, bot navbatdagi mijozga bo‘shagan vaqtni o‘zi taklif qiladi.",
    bg: "#FFF3DA",
    fg: "#A8751A",
  },
];

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="max-w-2xl">
        <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.18em] text-indigo-600">
          Imkoniyatlar
        </div>
        <h2 className="mt-3 font-display text-3xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-4xl">
          Yozuvni siz emas — Yozuv boshqaradi
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-ink-500">
          Slot hisoblash, eslatma yuborish va hisobotlar — hammasi avtomatik. Siz
          mijoz bilan ishlaysiz, qolganini bot qiladi.
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <div
            key={it.title}
            className="card-soft p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft-lg"
          >
            <div
              className="grid h-14 w-14 place-items-center rounded-2xl"
              style={{ background: it.bg, color: it.fg }}
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/70">
                <it.icon className="h-5 w-5" strokeWidth={2.2} />
              </span>
            </div>
            <h3 className="mt-5 font-display text-lg font-extrabold tracking-tight text-ink-900">
              {it.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{it.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
