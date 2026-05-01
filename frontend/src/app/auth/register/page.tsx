import Link from "next/link";
import { ArrowRight, Gift, Send, Sparkles } from "lucide-react";
import { HeroGradient } from "@/components/yz/HeroGradient";
import { YzLogo } from "@/components/yz/Logo";

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-ink-50">
      <HeroGradient className="rounded-b-[32px] pb-24">
        <div className="mx-auto flex w-full max-w-md items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <YzLogo size={36} variant="light" />
            <div className="font-display text-[17px] font-bold tracking-tight text-white">
              Yozuv
            </div>
          </Link>
          <Link
            href="/"
            className="rounded-xl bg-white/14 px-3 py-1.5 text-xs font-bold text-white backdrop-blur tap"
          >
            Bosh sahifa
          </Link>
        </div>
        <div className="mx-auto mt-10 max-w-md">
          <div className="text-sm font-semibold text-white/70">Yangi akkaunt</div>
          <h1 className="mt-1 font-display text-[32px] font-extrabold leading-tight tracking-[-0.02em] text-white">
            Bir bosishda ro‘yxatdan o‘ting
          </h1>
          <p className="mt-2 max-w-xs text-sm text-white/80">
            Yozuv Telegram orqali ishlaydi — alohida ro‘yxatdan o‘tish shart emas.
          </p>
        </div>
      </HeroGradient>

      <div className="-mt-16 px-4 pb-20">
        <div className="mx-auto max-w-md">
          <div className="card-soft p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Send className="h-6 w-6" strokeWidth={2.2} />
              </div>
              <div>
                <div className="font-display text-[15px] font-extrabold tracking-tight text-ink-900">
                  Qanday ishlaydi
                </div>
                <div className="text-xs text-ink-500">
                  2 qadam — keyin biznes yaratasiz
                </div>
              </div>
            </div>

            <ol className="mt-5 space-y-3 text-sm">
              {[
                "Kirish sahifasida Telegram orqali avtorizatsiya",
                "Dashboardda ochiq qolgan «Onboarding» formasini to‘ldiring",
                "Biznesingiz tayyor — mijozlar QR orqali yoziladi",
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-100 font-mono text-xs font-bold text-indigo-700">
                    {i + 1}
                  </div>
                  <span className="pt-1 text-ink-700">{t}</span>
                </li>
              ))}
            </ol>

            <Link
              href="/auth/login"
              className="btn-primary mt-6 w-full justify-center"
            >
              Kirish sahifasiga o‘tish <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div className="card-soft p-4">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#FFF3DA] text-warn">
                <Gift className="h-4 w-4" />
              </div>
              <div className="mt-2.5 font-display text-sm font-bold text-ink-900">
                14 kun bepul
              </div>
              <div className="mt-0.5 text-xs text-ink-500">Karta talab qilinmaydi</div>
            </div>
            <div className="card-soft p-4">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#E6FAF3] text-success">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="mt-2.5 font-display text-sm font-bold text-ink-900">
                Barcha imkoniyatlar
              </div>
              <div className="mt-0.5 text-xs text-ink-500">Cheklovsiz sinab ko‘ring</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
