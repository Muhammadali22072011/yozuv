import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Yozuv — Telegram orqali onlayn yozilish",
  description: "Kichik biznes uchun yozilishlar, eslatmalar va analitika.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={`${jakarta.variable} ${GeistSans.variable}`}>
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" async={false} />
      </head>
      <body className={`min-h-screen bg-ink-50 ${jakarta.className}`}>{children}</body>
    </html>
  );
}
