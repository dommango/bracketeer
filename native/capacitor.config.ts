import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor shell config for the iOS app. Lives in this standalone `native/`
// project (its own package.json + lockfile) so the web service never installs
// the iOS toolchain — the web app imports no @capacitor package, it only talks
// to the injected `window.Capacitor` global (see ../lib/native/bridge.ts).
//
// Build on a Mac: `cd native && npm install && npx cap add ios && npx cap sync`.
// The app wraps the hosted web service via server.url (the App Router app is SSR
// + API routes, so it can't be statically exported); `webDir` is a tiny offline
// fallback Capacitor bundles. Set CAPACITOR_SERVER_URL to the deployed origin.
//
// appId is the iOS bundle identifier — it MUST equal APNS_BUNDLE_ID on the
// server so the push topic matches.
const config: CapacitorConfig = {
  appId: "app.bracketeer",
  appName: "Bracketeer",
  // Required by the schema; unused at runtime when server.url is set.
  webDir: "public",
  server: {
    url: process.env.CAPACITOR_SERVER_URL || "https://bracketeer.app",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
