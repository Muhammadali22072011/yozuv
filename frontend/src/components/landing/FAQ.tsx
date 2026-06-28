import { Plus } from "lucide-react";

const FAQS = [
  {
    q: "Sayt yoki domen kerakmi?",
    a: "Yo‘q. Hammasi Telegram ichida ishlaydi — mijoz botda yoziladi, siz Mini App’da boshqarasiz. Sayt ham, ilova ham kerak emas.",
  },
  {
    q: "Mijoz biror narsa o‘rnatishi kerakmi?",
    a: "Yo‘q. Mijozda allaqachon bor bo‘lgan oddiy Telegram yetarli — havolani bossa, bron qiladi.",
  },
  {
    q: "To‘lovni qanday qilaman?",
    a: "Obunani Payme yoki Click orqali, so‘mda to‘laysiz. Chet el kartasi shart emas.",
  },
  {
    q: "14 kundan keyin avtomatik pul yechiladimi?",
    a: "Yo‘q. Sinov uchun karta talab qilinmaydi — yoqmasa, hech narsa to‘lamaysiz.",
  },
  {
    q: "Sozlash qiyinmi?",
    a: "5 daqiqa. Biznes nomi, xizmatlar va ish vaqtini kiritsangiz — botingiz mijozlarni qabul qila boshlaydi.",
  },
];

export function FAQ() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">
        Savol-javob
      </div>
      <h2 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-4xl">
        Tez-tez beriladigan savollar
      </h2>

      <div className="mt-8 space-y-3">
        {FAQS.map((f) => (
          <details
            key={f.q}
            className="group card-soft overflow-hidden p-0 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
              <span className="font-display text-[15px] font-bold tracking-tight text-ink-900">
                {f.q}
              </span>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-50 text-indigo-600 transition-transform group-open:rotate-45">
                <Plus className="h-4 w-4" strokeWidth={2.5} />
              </span>
            </summary>
            <p className="px-5 pb-5 text-sm leading-relaxed text-ink-500">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
