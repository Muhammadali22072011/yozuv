"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Mail,
  Send,
  X,
} from "lucide-react";

/**
 * Always-on help drawer. Owner taps "?" in the dashboard hero, gets a
 * collapsible FAQ covering every major feature: how to add a service,
 * how to invite a master, what stamp cards do, how to read the
 * notification bell, etc. Plus a "support contacts" footer so a stuck
 * owner has somewhere to write.
 *
 * The data lives inline as a const — fewer pieces to keep in sync than
 * a CMS. When adding a feature, append a TIPS entry next to its model
 * row in the same PR.
 */

type Tip = { q: string; a: string };

const TIPS: Tip[] = [
  {
    q: "Xizmat qanday qo'shaman?",
    a: "Sozlamalar → Xizmatlar bo'limiga kiring. «Qo'shish» tugmasini bosing, nomini, narxini va davomiyligini kiriting. Mijozlar boshqa xizmatlar qatorida ko'radi.",
  },
  {
    q: "Mutaxassislarni qanday qo'shaman?",
    a: "Sozlamalar → Mutaxassislar bo'limidan har bir usta uchun karta qo'shing va u qaysi xizmatlarni bajara olishini belgilang. Mijoz yozilishda kerakli ustani tanlaydi.",
  },
  {
    q: "Mijozlarga havolani qanday yuboraman?",
    a: "Bosh sahifada «Mijozlar havolangiz» kartasini bosing — havola buferiga ko'chiriladi. Uni WhatsApp, Instagram, vizit kartochkasi yoki broshyura PDF orqali ulashing.",
  },
  {
    q: "Bron qachon avtomatik tasdiqlanadi?",
    a: "Profil → Tasdiqlash rejimi. AVTOMATIK — har bir bron darhol tasdiqlanadi. QO'LDA — har birini siz tasdiqlaysiz (bot orqali yoki dashboarddan). Oldindan to'lov — mijoz pulni o'tkazgandan keyin.",
  },
  {
    q: "Eslatmalar qanday ishlaydi?",
    a: "Yozilishdan 1 soat oldin mijozga avtomatik xabar boradi. Hech qanday sozlash kerak emas. Eslatma matnini biznes profili sahifasidan o'zgartirsangiz bo'ladi.",
  },
  {
    q: "Mijozni qanday bloklayman?",
    a: "Mijoz kartasini oching → «Bloklash» tugmasini bosing. Sabab kiriting (mijozga ko'rsatilmaydi). Bloklangan mijoz boshqa sizga yozila olmaydi.",
  },
  {
    q: "Promo-kod qanday tarqataman?",
    a: "Sozlamalar → Promo-kodlar. Kod yarating (chegirma % yoki sum), maksimal foydalanish sonini belgilang. Mijoz bron qilayotganda kodni kiritadi.",
  },
  {
    q: "Sodiqlik shtampi nima?",
    a: "Xizmat sozlamalarida «N tashrifdan keyin bepul» qiymatini belgilang. Tizim har bir mijoz uchun avtomatik hisoblaydi va N+1-tashrifni narxi 0 qilib bron qiladi.",
  },
  {
    q: "Tug'ilgan kun avtomatik tabriklanadimi?",
    a: "Mijoz kartochkasiga sanasini kiriting. O'sha kuni soat 09:30 da bot avtomatik tabriklaydi va so'nggi tashrif bo'lgan biznesingizni eslatadi.",
  },
  {
    q: "Bildirishnoma qo'ng'iroqchasini bosganda nima ko'raman?",
    a: "Yangi bron, otmen, izoh va obuna haqidagi xabarlar. Tepada raqam — yangi (hali ko'rilmagan) xabarlar soni. Karta yozish bilan o'qilgan deb belgilanadi.",
  },
  {
    q: "Bir nechta biznesim (filialim) bo'lsa-chi?",
    a: "Hozircha har bir akkaunt bitta biznesni boshqaradi. Qo'shimcha biznes yoki filial uchun alohida akkaunt (boshqa login bilan) oching.",
  },
];

export function HelpDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2800] flex items-end justify-center bg-ink-900/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-4xl bg-ink-50 shadow-soft-lg sm:rounded-4xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-ink-100 bg-white px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-2xl tile-indigo">
              <HelpCircle className="h-5 w-5 text-indigo-600" strokeWidth={2.2} />
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight text-ink-900">
              Yordam
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Yopish"
            className="grid h-9 w-9 place-items-center rounded-xl text-ink-400 hover:bg-ink-100 tap-icon"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-2">
            {TIPS.map((t, i) => {
              const isOpen = openIdx === i;
              return (
                <div
                  key={i}
                  className={`overflow-hidden rounded-3xl bg-white transition-shadow ${
                    isOpen ? "shadow-soft ring-1 ring-indigo-100" : "shadow-soft"
                  }`}
                >
                  <button
                    onClick={() => setOpenIdx(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left tap"
                  >
                    <span className="font-display text-sm font-bold tracking-tight text-ink-900">
                      {t.q}
                    </span>
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-xl transition-colors ${
                        isOpen ? "tile-indigo text-indigo-600" : "bg-ink-50 text-ink-400"
                      }`}
                    >
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4" strokeWidth={2.4} />
                      ) : (
                        <ChevronDown className="h-4 w-4" strokeWidth={2.4} />
                      )}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 text-sm leading-relaxed text-ink-700">
                      {t.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-ink-100 bg-white px-5 py-4">
          <div className="text-xs font-semibold text-ink-500">
            Javob topa olmadingizmi?
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <a
              href="https://t.me/yozuv_support"
              target="_blank"
              rel="noopener"
              className="btn-primary inline-flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-bold tap"
            >
              <Send className="h-3.5 w-3.5" />
              Telegram support
            </a>
            <a
              href="mailto:support@yozuv.com"
              className="btn-soft inline-flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-bold text-indigo-700 tap"
            >
              <Mail className="h-3.5 w-3.5" />
              Pochta
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
