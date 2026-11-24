/**
 * Greeting the owner picks in Settings (owner, 2026-11-25: shopkeepers of every faith use the app).
 * Used on the home header, the বাকি reminder message and the help message. Stored on this phone
 * (a per-device preference); default আসসালামু আলাইকুম.
 */
import { useSyncExternalStore } from 'react';

export const GREETINGS = [
  { key: 'salam', text: 'আসসালামু আলাইকুম' },
  { key: 'nomoskar', text: 'নমস্কার' },
  { key: 'shubhechha', text: 'শুভেচ্ছা' },
  { key: 'none', text: '' },
] as const;
export type GreetingKey = (typeof GREETINGS)[number]['key'];

const KEY = 'jk_greeting';
const EVENT = 'jk:greeting';

export function getGreetingKey(): GreetingKey {
  try {
    const v = localStorage.getItem(KEY);
    return GREETINGS.some((g) => g.key === v) ? (v as GreetingKey) : 'salam';
  } catch {
    return 'salam';
  }
}

export function setGreetingKey(key: GreetingKey) {
  try {
    localStorage.setItem(KEY, key);
  } catch {
    /* storage blocked: keep the default */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** The words, e.g. "নমস্কার"; '' when the owner chose none. */
export function greetingText(key: GreetingKey = getGreetingKey()): string {
  return GREETINGS.find((g) => g.key === key)?.text ?? '';
}

export function useGreetingKey(): GreetingKey {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      window.addEventListener('storage', cb);
      return () => {
        window.removeEventListener(EVENT, cb);
        window.removeEventListener('storage', cb);
      };
    },
    getGreetingKey,
    () => 'salam',
  );
}
