import type { CapacitorConfig } from "@capacitor/cli";

// The native app is a thin shell that loads the deployed Yozuv web app.
// Set CAP_SERVER_URL to the public HTTPS URL of the frontend (the same
// URL used as the Telegram Mini App) before running `cap sync` / building.
// Example: CAP_SERVER_URL=https://app.yozuv.uz
const SERVER_URL = process.env.CAP_SERVER_URL || "";

const config: CapacitorConfig = {
  appId: "uz.yozuv.app",
  appName: "Yozuv",
  // Local fallback assets shown before the remote URL loads (or offline).
  webDir: "mobile-shell",
  ...(SERVER_URL
    ? {
        server: {
          url: SERVER_URL,
          // Require HTTPS — never load the app over plain HTTP.
          cleartext: false,
        },
      }
    : {}),
  android: {
    // Lets the WebView keep cookies/localStorage across launches so the
    // saved login token survives app restarts.
    webContentsDebuggingEnabled: false,
  },
};

export default config;
