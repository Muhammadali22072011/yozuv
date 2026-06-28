import {
  Camera,
  Dumbbell,
  GraduationCap,
  HeartPulse,
  type LucideIcon,
  Scissors,
  Smile,
  Sparkles,
  Stethoscope,
} from "lucide-react";

const cats: { name: string; Icon: LucideIcon; tile: string }[] = [
  { name: "Barbershop", Icon: Scissors, tile: "tile-indigo" },
  { name: "Salon", Icon: Sparkles, tile: "tile-coral" },
  { name: "Stomatologiya", Icon: Smile, tile: "tile-mint" },
  { name: "Repetitor", Icon: GraduationCap, tile: "tile-lemon" },
  { name: "Foto", Icon: Camera, tile: "tile-lilac" },
  { name: "Massaj", Icon: HeartPulse, tile: "tile-coral" },
  { name: "Fitness", Icon: Dumbbell, tile: "tile-mint" },
  { name: "Klinika", Icon: Stethoscope, tile: "tile-sky" },
];

export function Categories() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="eyebrow text-indigo-600">Kategoriyalar</div>
      <h2 className="mt-2.5 font-display text-3xl font-extrabold tracking-tighter text-ink-900 md:text-4xl">
        Sizning sohangiz uchun ham ishlaydi
      </h2>
      <p className="mt-3 max-w-xl text-ink-500">
        Yozuv orqali yoziladigan har qanday xizmat — barberdan klinikagacha.
      </p>

      <div className="mt-10 grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {cats.map((c) => (
          <div
            key={c.name}
            className={`${c.tile} tap flex items-center gap-3.5 p-4`}
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/70 text-ink-900 shadow-soft-sm">
              <c.Icon className="h-5 w-5" strokeWidth={2} />
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
