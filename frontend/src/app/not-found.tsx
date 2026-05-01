import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-ink-50 px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#EEF0FF]">
          <Compass className="h-8 w-8 text-indigo-600" strokeWidth={2.2} />
        </div>
        <div className="mt-5 font-mono text-xs font-bold uppercase tracking-[0.2em] text-ink-400">
          404
        </div>
        <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink-900">
          Sahifa topilmadi
        </h1>
        <p className="mt-2 text-sm text-ink-500">
          Bu havola eskirgan yoki noto‘g‘ri bo‘lishi mumkin.
        </p>

        <Link
          href="/"
          className="btn-primary mt-6 inline-flex justify-center"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Bosh sahifaga
        </Link>
      </div>
    </main>
  );
}
