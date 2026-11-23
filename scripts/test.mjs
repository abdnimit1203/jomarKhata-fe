// Runs Vitest. On Windows a lower-case drive letter in the working directory ("d:\…") makes
// Vitest 5 load its runner twice and every file fails with
// "Cannot read properties of undefined (reading 'config')". Start it from "D:\…" instead.
// Usage: npm test [-- vitest args]
import { spawnSync } from 'node:child_process';

let cwd = process.cwd();
if (process.platform === 'win32' && /^[a-z]:/.test(cwd)) cwd = cwd[0].toUpperCase() + cwd.slice(1);

const args = process.argv.slice(2);
const result = spawnSync('npx', ['vitest', ...(args.length ? args : ['run'])], {
  cwd,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
