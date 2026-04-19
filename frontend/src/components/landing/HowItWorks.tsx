const steps = [
  { n: "01", title: "Biznes yarating", desc: "Nom, kategoriya va xizmatlarni qo‘shing." },
  { n: "02", title: "Telegramda ulaning", desc: "Havola va QR — mijozlar bot orqali yoziladi." },
  { n: "03", title: "Slotlarni boshqaring", desc: "Tasdiqlash rejimi: avto, qo‘lda yoki oldindan to‘lov." },
  { n: "04", title: "O‘sing", desc: "Analitika va eslatmalar bilan qayta tashriflarni oshiring." },
];

export function HowItWorks() {
  return (
    <section className="border-y border-ink/10 bg-cream">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-serif text-3xl text-ink md:text-4xl">Qanday ishlaydi</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-ink/10 bg-paper p-6">
              <p className="text-sm font-semibold text-brand">{s.n}</p>
              <h3 className="mt-2 font-serif text-xl">{s.title}</h3>
              <p className="mt-2 text-sm text-ink/70">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
