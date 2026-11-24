"use client";

/**
 * PWA helpers (S12): update prompt + install prompt state shared between the service-worker
 * registration (root layout) and the app UI. Plain module state + window events; no React needed.
 */
export const SW_UPDATE_EVENT = "jk-sw-update";
export const INSTALL_EVENT = "jk-installable";

let waiting: ServiceWorker | null = null;
let userAskedToUpdate = false;

/** Called by the registration code when a new version has installed and is waiting. */
export function setWaitingWorker(w: ServiceWorker | null) {
  waiting = w;
  if (w) window.dispatchEvent(new Event(SW_UPDATE_EVENT));
}

export function hasWaitingUpdate(): boolean {
  return waiting !== null;
}

/** "আপডেট করুন": activate the waiting version; the page reloads once it takes control. */
export function applyUpdate() {
  if (!waiting) return;
  userAskedToUpdate = true;
  waiting.postMessage({ type: "SKIP_WAITING" });
}

export function shouldReloadOnControllerChange(): boolean {
  return userAskedToUpdate;
}

// ---- install prompt (Android/desktop Chrome fire `beforeinstallprompt`; iOS Safari never does)
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let deferredInstall: BeforeInstallPromptEvent | null = null;

export function captureInstallPrompt(e: Event) {
  e.preventDefault(); // keep it for our own button
  deferredInstall = e as BeforeInstallPromptEvent;
  window.dispatchEvent(new Event(INSTALL_EVENT));
}

export function canPromptInstall(): boolean {
  return deferredInstall !== null;
}

export async function promptInstall(): Promise<
  "accepted" | "dismissed" | "unavailable"
> {
  if (!deferredInstall) return "unavailable";
  const e = deferredInstall;
  deferredInstall = null;
  await e.prompt();
  return (await e.userChoice).outcome;
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Set by the `appinstalled` listener (PwaPrompts): this phone/PC already has the app. */
export function wasInstalled(): boolean {
  try {
    return window.localStorage.getItem("jk_installed") === "1";
  } catch {
    return false;
  }
}

export function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

/** Facebook / Messenger / Instagram etc. open links in their own browser, which cannot install apps. */
export function isInAppBrowser(): boolean {
  return /FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\/|; wv\)/i.test(
    navigator.userAgent,
  );
}
