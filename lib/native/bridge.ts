// Web-safe bridge to the Capacitor native runtime. The web bundle must NOT
// import any @capacitor/* package (they're only installed for the iOS build on a
// Mac), so we talk to the runtime exclusively through the `window.Capacitor`
// global that the native shell injects. In a plain browser the global is absent
// and every function here is an inert no-op — the same code ships to web and iOS.

// Minimal shape of the plugin methods we call — just enough to stay type-safe
// without depending on the Capacitor type packages.
interface PermissionStatus {
  receive: "prompt" | "prompt-with-rationale" | "granted" | "denied";
}
interface PushPlugin {
  requestPermissions(): Promise<PermissionStatus>;
  register(): Promise<void>;
  addListener(event: string, cb: (data: unknown) => void): Promise<unknown> | unknown;
}
interface StatusBarPlugin {
  setStyle(opts: { style: string }): Promise<void>;
}
interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, unknown>;
}

function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function isNativeApp(): boolean {
  return capacitor()?.isNativePlatform?.() === true;
}

export function nativePlatform(): string | null {
  return capacitor()?.getPlatform?.() ?? null;
}

function plugin<T>(name: string): T | undefined {
  return capacitor()?.Plugins?.[name] as T | undefined;
}

// POST the device token to our store. Mirrors app/api/push/register.
async function persistToken(token: string): Promise<void> {
  try {
    await fetch("/api/push/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, platform: "IOS" }),
    });
  } catch (err) {
    console.error("push token registration failed:", err);
  }
}

// Request notification permission and register for APNs. Safe to call on every
// app open: Apple returns the same token, and our register endpoint upserts.
// No-op in a browser or if the plugin isn't present.
export async function initNativePush(): Promise<void> {
  const push = plugin<PushPlugin>("PushNotifications");
  if (!isNativeApp() || !push) return;
  try {
    const perm = await push.requestPermissions();
    if (perm.receive !== "granted") return;
    await push.addListener("registration", (data) => {
      const token = (data as { value?: string })?.value;
      if (token) void persistToken(token);
    });
    await push.addListener("registrationError", (err) =>
      console.error("APNs registration error:", err),
    );
    await push.register();
  } catch (err) {
    console.error("initNativePush failed:", err);
  }
}

// Match the dark-green chrome with light status-bar content. Best-effort.
export async function initStatusBar(): Promise<void> {
  const bar = plugin<StatusBarPlugin>("StatusBar");
  if (!isNativeApp() || !bar) return;
  try {
    await bar.setStyle({ style: "DARK" }); // dark background → light icons
  } catch {
    /* plugin not installed in this build */
  }
}

// One-shot native initialization run from the client bootstrap component.
export async function initNativeApp(): Promise<void> {
  if (!isNativeApp()) return;
  await Promise.all([initNativePush(), initStatusBar()]);
}
