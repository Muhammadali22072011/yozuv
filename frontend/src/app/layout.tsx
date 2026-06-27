import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { CapacitorDeepLink } from "@/components/CapacitorDeepLink";
import { ReferralCapture } from "@/components/ReferralCapture";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://yozuv.uz";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Yozuv — Telegram orqali onlayn yozilish",
  description:
    "Toshkent va butun O'zbekiston bo'ylab barbershop, salon, stomatologiya va boshqa xizmatlarga Telegram orqali onlayn yozilish.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "uz_UZ",
    siteName: "Yozuv",
    url: SITE_URL,
    title: "Yozuv — Telegram orqali onlayn yozilish",
    description:
      "Barbershop, salon, klinika va xizmatlarga Telegram orqali onlayn yozilish — O'zbekiston bo'ylab.",
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#4853F5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={`${jakarta.variable} ${GeistSans.variable}`}>
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" async={false} />
      </head>
      <body className={`min-h-screen bg-ink-50 ${jakarta.className}`}>
        <CapacitorDeepLink />
        <ReferralCapture />
        {children}
      </body>
    </html>
  );
}
