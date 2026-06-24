const cats = [
  { name: "Barbershop", emoji: "💈", bg: "#EEF0FF" },
  { name: "Salon", emoji: "💇", bg: "#FFE7E3" },
  { name: "Stomatologiya", emoji: "🦷", bg: "#E6FAF3" },
  { name: "Repetitor", emoji: "📚", bg: "#FFF3DA" },
  { name: "Foto", emoji: "📸", bg: "#EEF0FF" },
  { name: "Massaj", emoji: "💆", bg: "#FFE7E3" },
  { name: "Fitness", emoji: "🏋️", bg: "#E6FAF3" },
  { name: "Klinika", emoji: "⚕️", bg: "#FFF3DA" },
];

export function Categories() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">
        Kategoriyalar
      </div>
      <h2 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-4xl">
        Sizning sohangiz uchun ham ishlaydi
      </h2>
      <p className="mt-3 max-w-xl text-ink-500">
        Yozuv orqali yoziladigan har qanday xizmat — barberdan klinikagacha.
      </p>

      <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        {cats.map((c) => (
          <div
            key={c.name}
            className="card-soft flex items-center gap-3 px-4 py-3.5"
          >
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl"
              style={{ background: c.bg }}
            >
              {c.emoji}
            </div>
            <span className="font-display text-sm font-bold text-ink-900">
              {c.name}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
