import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-ink-50 px-5 py-16">
      <div className="card-lg animate-card-in w-full max-w-md p-8 text-center">
        <div className="tile-indigo mx-auto grid h-20 w-20 place-items-center rounded-3xl">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/70 shadow-soft-sm backdrop-blur">
            <Compass className="h-6 w-6 text-indigo-600" strokeWidth={2.2} />
          </span>
        </div>
        <div className="eyebrow tnum mt-6">404</div>
        <h1 className="section-title mt-2 text-2xl">Sahifa topilmadi</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          Bu havola eskirgan yoki noto‘g‘ri bo‘lishi mumkin.
        </p>

        <Link
          href="/"
          className="btn-primary tap mt-7 inline-flex w-full justify-center"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Bosh sahifaga
        </Link>
      </div>
    </main>
  );
}
