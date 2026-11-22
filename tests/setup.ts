// Test-only environment setup. Nothing here is shipped to the app.
import 'fake-indexeddb/auto';

// `getJomarkhataDb()` refuses to run outside a browser (it checks `window`).
// Tests run in Node with fake-indexeddb, so expose a minimal `window` shim.
(globalThis as unknown as { window: typeof globalThis }).window = globalThis;
