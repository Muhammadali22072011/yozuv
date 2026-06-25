import { Store, Send, CalendarClock, TrendingUp } from "lucide-react";

const steps = [
  {
    n: "01",
    title: "Biznesni qo‘shing",
    desc: "Nom, kategoriya va xizmatlarni kiriting — 2 daqiqa.",
    tile: "tile-indigo",
    accent: "#4853F5",
    icon: Store,
  },
  {
    n: "02",
    title: "Telegramga ulang",
    desc: "Havola va QR tayyor — mijozlar shu zahoti bot orqali yozila boshlaydi.",
    tile: "tile-sky",
    accent: "#2E8BE6",
    icon: Send,
  },
  {
    n: "03",
    title: "Yozuvlarni qabul qiling",
    desc: "Tasdiqni o‘zingiz tanlaysiz: avto, qo‘lda yoki oldindan to‘lov bilan.",
    tile: "tile-mint",
    accent: "#16A37B",
    icon: CalendarClock,
  },
  {
    n: "04",
    title: "O‘sing",
    desc: "Eslatma va analitika qayta tashriflarni oshiradi — daromad ko‘rinib turadi.",
    tile: "tile-lemon",
    accent: "#C98A1E",
    icon: TrendingUp,
  },
];

export function HowItWorks() {
  return (
    <section className="bg-ink-50">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="eyebrow text-indigo-600">Qanday ishlaydi</div>
        <h2 className="mt-2 section-title text-3xl tracking-[-0.02em] md:text-4xl">
          5 daqiqada ishga tushasiz
        </h2>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.n} className="card-soft relative overflow-hidden p-6">
                <div className="flex items-center justify-between">
                  <div className={`${s.tile} grid h-12 w-12 place-items-center p-0`}>
                    <span className="grid h-9 w-9 place-items-center rounded-2xl bg-white/70">
                      <Icon className="h-5 w-5" strokeWidth={2} style={{ color: s.accent }} />
                    </span>
                  </div>
                  <span className="tnum font-display text-[34px] font-extrabold leading-none tracking-tighter text-ink-200">
                    {s.n}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-ink-900">
                  {s.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
