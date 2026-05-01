const steps = [
  { n: "01", title: "Biznes yarating", desc: "Nom, kategoriya va xizmatlarni qo‘shing." },
  { n: "02", title: "Telegramda ulaning", desc: "Havola va QR — mijozlar bot orqali yoziladi." },
  { n: "03", title: "Slotlarni boshqaring", desc: "Tasdiqlash rejimi: avto, qo‘lda yoki oldindan to‘lov." },
  { n: "04", title: "O‘sing", desc: "Analitika va eslatmalar bilan qayta tashriflarni oshiring." },
];

export function HowItWorks() {
  return (
    <section className="bg-ink-50">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">
          Qanday ishlaydi
        </div>
        <h2 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-4xl">
          4 ta qadam — va sizda biznes onlayn
        </h2>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="card-soft p-6">
              <div className="inline-flex rounded-full bg-indigo-50 px-3 py-1 font-mono text-xs font-bold text-indigo-700">
                {s.n}
              </div>
              <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-ink-900">
                {s.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
