import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor shell config for the iOS app. This file is excluded from the Next
// build / tsc (see tsconfig "exclude") because @capacitor/cli is only installed
// on the Mac where the native app is built — the web service never imports it.
//
// The app wraps the hosted web service rather than bundling a static export
// (the App Router app is SSR + API routes, so it can't be statically exported).
// Native value beyond a webview comes from the Capacitor plugins below + APNs
// push. Set CAPACITOR_SERVER_URL to the deployed origin at native-build time.
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
