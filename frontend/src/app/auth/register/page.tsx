import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="font-serif text-3xl">Ro‘yxatdan o‘tish</h1>
      <p className="mt-2 text-sm text-ink/60">
        Avval Telegram orqali kiring, keyin dashboardda biznes yarating.
      </p>
      <Link className="mt-8 text-brand underline" href="/auth/login">
        Kirish sahifasiga o‘tish
      </Link>
    </div>
  );
}
