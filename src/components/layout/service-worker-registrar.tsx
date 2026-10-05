"use client";

import { useEffect } from "react";

/**
 * Registers the service worker that makes Hydra installable and keeps the app
 * shell available offline. Registration is deferred until after load so it
 * never competes with the first paint.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline support is an enhancement; the app works fine without it.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
