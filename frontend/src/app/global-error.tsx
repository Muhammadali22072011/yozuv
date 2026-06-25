"use client";

import { AlertTriangle, RotateCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="uz">
      <body
        style={{
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          background: "#F5F6FB",
          color: "#0B0F1F",
          margin: 0,
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding:
              "max(24px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left))",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 400,
              textAlign: "center",
              background: "#FFFFFF",
              borderRadius: 32,
              padding: "40px 28px",
              boxShadow:
                "0 1px 2px rgba(11, 15, 31, 0.04), 0 18px 48px -16px rgba(11, 15, 31, 0.16)",
            }}
          >
            <div
              style={{
                margin: "0 auto",
                width: 72,
                height: 72,
                borderRadius: 24,
                background: "#FFE7E3",
                display: "grid",
                placeItems: "center",
                color: "#F0563A",
              }}
            >
              <AlertTriangle size={32} strokeWidth={2.2} aria-hidden="true" />
            </div>
            <h1
              style={{
                marginTop: 24,
                marginBottom: 0,
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "#0B0F1F",
              }}
            >
              Nimadir noto‘g‘ri ketdi
            </h1>
            <p
              style={{
                marginTop: 10,
                marginBottom: 0,
                color: "#5C6276",
                fontSize: 15,
                lineHeight: 1.5,
              }}
            >
              Iltimos, qayta urinib ko‘ring.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                marginTop: 28,
                width: "100%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "15px 24px",
                borderRadius: 18,
                background: "linear-gradient(180deg, #5B6BFF 0%, #4853F5 100%)",
                color: "white",
                border: "none",
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                cursor: "pointer",
                boxShadow:
                  "0 12px 26px -10px rgba(72, 83, 245, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.22)",
              }}
            >
              <RotateCw size={18} strokeWidth={2.4} aria-hidden="true" />
              Qayta urinish
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
