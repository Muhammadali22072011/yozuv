import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import Script from "next/script";
import "./globals.css";
import { CapacitorDeepLink } from "@/components/CapacitorDeepLink";
import { ReferralCapture } from "@/components/ReferralCapture";

// Turn-key analytics: set ONE env var and the provider script loads here, then
// lib/analytics `track()` auto-forwards to its global. No provider set → events
// still reach our own /api/events sink (first-party), so the funnel is never
// fully blind. (GA4 = NEXT_PUBLIC_GA_ID, Plausible = NEXT_PUBLIC_PLAUSIBLE_DOMAIN.)
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

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
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
            </Script>
          </>
        )}
        {PLAUSIBLE_DOMAIN && (
          <Script
            defer
            data-domain={PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className={`min-h-screen bg-ink-50 ${jakarta.className}`}>
        <CapacitorDeepLink />
        <ReferralCapture />
        {children}
      </body>
    </html>
  );
}
