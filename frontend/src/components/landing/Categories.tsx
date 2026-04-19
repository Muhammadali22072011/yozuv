const cats = [
  "Barbershop",
  "Salon",
  "Stomatologiya",
  "Repetitor",
  "Foto",
  "Massaj",
  "Fitness",
  "Klinika",
];

export function Categories() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <h2 className="font-serif text-3xl text-ink md:text-4xl">Kategoriyalar</h2>
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {cats.map((c) => (
          <div key={c} className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm">
            {c}
          </div>
        ))}
      </div>
    </section>
  );
}
