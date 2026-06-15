# Bracketeer iOS (Capacitor)

Standalone Capacitor project that wraps the **hosted** Bracketeer web app in a
native iOS shell (App Store distribution + native push). It is intentionally
**separate from the web app's `package.json`** so the Railway web service never
installs the iOS toolchain (`@capacitor/cli` and its native-build tooling).

The web app imports **no** `@capacitor/*` package — it only calls the
`window.Capacitor` global the native runtime injects (see
`../lib/native/bridge.ts`). So nothing here affects the web build.

## Build (requires macOS + Xcode)

```bash
cd native
npm install
CAPACITOR_SERVER_URL="https://<deployed-origin>" npx cap add ios   # first time
CAPACITOR_SERVER_URL="https://<deployed-origin>" npx cap sync ios
npx cap open ios                                                   # opens Xcode
```

- `appId` in `capacitor.config.ts` (`app.bracketeer`) is the bundle id and **must
  equal the server's `APNS_BUNDLE_ID`** so the push topic matches.
- The app loads the live site from `server.url`; `public/` is only the offline
  fallback Capacitor bundles.
- Enable the **Push Notifications** capability in Xcode and register the APNs key
  in App Store Connect; the device token is POSTed to `/api/push/register`.
