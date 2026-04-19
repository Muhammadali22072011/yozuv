import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

const instrument = Instrument_Serif({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Yozuv — Telegram orqali onlayn yozilish",
  description: "Kichik biznes uchun yozilishlar, eslatmalar va analitika.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={`${instrument.variable} ${GeistSans.variable}`}>
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" async={false} />
      </head>
      <body className={`min-h-screen ${GeistSans.className}`}>{children}</body>
    </html>
  );
}
