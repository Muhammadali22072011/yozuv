const cats = [
  { name: "Barbershop", emoji: "💈", tile: "tile-indigo" },
  { name: "Salon", emoji: "💇", tile: "tile-coral" },
  { name: "Stomatologiya", emoji: "🦷", tile: "tile-mint" },
  { name: "Repetitor", emoji: "📚", tile: "tile-lemon" },
  { name: "Foto", emoji: "📸", tile: "tile-lilac" },
  { name: "Massaj", emoji: "💆", tile: "tile-coral" },
  { name: "Fitness", emoji: "🏋️", tile: "tile-mint" },
  { name: "Klinika", emoji: "⚕️", tile: "tile-sky" },
];

export function Categories() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="eyebrow text-indigo-600">Kategoriyalar</div>
      <h2 className="mt-2.5 font-display text-3xl font-extrabold tracking-tighter text-ink-900 md:text-4xl">
        Kimga mos keladi
      </h2>

      <div className="mt-10 grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {cats.map((c) => (
          <div
            key={c.name}
            className={`${c.tile} tap flex items-center gap-3.5 p-4`}
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/70 text-xl shadow-soft-sm">
              {c.emoji}
            </div>
            <span className="font-display text-sm font-bold tracking-tight text-ink-900">
              {c.name}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
