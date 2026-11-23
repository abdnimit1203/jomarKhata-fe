// Runs Vitest. On Windows a lower-case drive letter in the working directory ("d:\…") makes
// Vitest 5 load its runner twice and every file fails with
// "Cannot read properties of undefined (reading 'config')". Start it from "D:\…" instead.
// Usage: npm test [-- vitest args]
import { spawnSync } from 'node:child_process';

let cwd = process.cwd();
if (process.platform === 'win32' && /^[a-z]:/.test(cwd)) cwd = cwd[0].toUpperCase() + cwd.slice(1);

// `npm test` and `npm test -- tests/x.test.ts` run once; `npm test -- watch` watches.
const args = process.argv.slice(2);
const mode = ['run', 'watch', 'dev'].includes(args[0]) ? [] : ['run'];
const result = spawnSync('npx', ['vitest', ...mode, ...args], {
  cwd,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
