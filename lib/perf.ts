/**
 * Opt-in timing log for performance checks (S13). Silent unless `localStorage.jk_perf === '1'`,
 * so shopkeepers never see it; testers enable it in the browser console.
 */
export function perfEnabled(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem('jk_perf') === '1';
  } catch {
    return false;
  }
}

export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!perfEnabled()) return fn();
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    console.info(`[jk-perf] ${label}: ${Math.round(performance.now() - t0)} ms`);
  }
}
