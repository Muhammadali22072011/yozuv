"use client";

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
          background: "#F4F5FA",
          margin: 0,
        }}
      >
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "24px",
          }}
        >
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <div
              style={{
                margin: "0 auto",
                width: 64,
                height: 64,
                borderRadius: 16,
                background: "#FFE7E3",
                display: "grid",
                placeItems: "center",
                fontSize: 28,
              }}
            >
              ⚠️
            </div>
            <h1
              style={{
                marginTop: 20,
                fontSize: 24,
                fontWeight: 800,
                color: "#0B0F1F",
              }}
            >
              Nimadir noto‘g‘ri ketdi
            </h1>
            <p style={{ marginTop: 8, color: "#5C6276", fontSize: 14 }}>
              Iltimos, qayta urinib ko‘ring.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                marginTop: 24,
                padding: "14px 24px",
                borderRadius: 16,
                background: "#4853F5",
                color: "white",
                border: "none",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Qayta urinish
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
