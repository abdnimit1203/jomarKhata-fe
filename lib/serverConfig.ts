"use client";

/**
 * Public values the owner edits in the admin dashboard (GET /config): helpline WhatsApp + email,
 * whether the "সমস্যা জানান" button shows, … Fetched once per app open when online and kept on
 * this device, so the helpline still shows offline. Env values are only the fallback.
 */
import { useSyncExternalStore } from "react";
import { apiFetch } from "./api";

export interface ServerConfig {
  supportWhatsApp: string;
  supportEmail: string;
  bugReportEnabled: boolean;
}

const KEY = "jk_server_config";
const FALLBACK: ServerConfig = {
  supportWhatsApp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "",
  supportEmail: "",
  bugReportEnabled: false, // shown only once the server has said it is on
};

let current: ServerConfig = FALLBACK;
let loaded = false;
let fetching: Promise<void> | null = null;
const listeners = new Set<() => void>();

function readSaved() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(KEY) ?? "null",
    ) as Partial<ServerConfig> | null;
    if (saved) current = { ...FALLBACK, ...saved };
  } catch {
    /* private mode / bad JSON: keep the fallback */
  }
}

/** Refresh from the server (once per page load); silent when offline. */
export function refreshServerConfig(): Promise<void> {
  fetching ??= apiFetch<Partial<ServerConfig>>("/config")
    .then((c) => {
      current = {
        supportWhatsApp: c.supportWhatsApp || FALLBACK.supportWhatsApp,
        supportEmail: c.supportEmail ?? "",
        bugReportEnabled: c.bugReportEnabled ?? false,
      };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(current));
      } catch {
        /* ignore */
      }
      listeners.forEach((l) => l());
    })
    .catch(() => {
      fetching = null; // try again next time
    });
  return fetching;
}

export function getServerConfig(): ServerConfig {
  readSaved();
  return current;
}

export function useServerConfig(): ServerConfig {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      void refreshServerConfig();
      return () => listeners.delete(l);
    },
    getServerConfig,
    () => FALLBACK,
  );
}
