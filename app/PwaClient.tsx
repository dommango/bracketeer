"use client";

// Client-only bootstrap, mounted once in the root layout. Registers the
// app-shell service worker (browsers + installed PWA) and runs native init
// (push registration, status bar) when running inside the Capacitor iOS shell.
// Renders nothing.

import { useEffect } from "react";
import { initNativeApp } from "@/lib/native/bridge";

export default function PwaClient() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Register after load so it never competes with first paint.
      const onLoad = () => {
        navigator.serviceWorker.register("/sw.js").catch((err) => {
          console.error("service worker registration failed:", err);
        });
      };
      if (document.readyState === "complete") onLoad();
      else window.addEventListener("load", onLoad, { once: true });
    }

    void initNativeApp();
  }, []);

  return null;
}
