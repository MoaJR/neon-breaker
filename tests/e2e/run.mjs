/**
 * Runs the browser E2E suite, booting the static server when needed.
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const PORT = process.env.PORT || 4173;
const BASE = `http://127.0.0.1:${PORT}/`;

async function isUp() {
  try {
    const response = await fetch(BASE, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

let server = null;
if (!(await isUp())) {
  server = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT },
    stdio: 'ignore',
  });
  let ready = false;
  for (let attempt = 0; attempt < 50 && !ready; attempt += 1) {
    await delay(120);
    ready = await isUp();
  }
  if (!ready) {
    console.error('Could not start the static server.');
    server.kill();
    process.exit(1);
  }
}

const suites = ['tests/e2e/smoke.mjs', 'tests/e2e/flows.mjs', 'tests/e2e/roguelite.mjs'];
let exitCode = 0;

for (const suite of suites) {
  const child = spawn(process.execPath, [suite], {
    env: { ...process.env, BASE_URL: BASE },
    stdio: 'inherit',
  });
  const code = await new Promise((resolve) => child.on('exit', (value) => resolve(value ?? 1)));
  if (code !== 0) exitCode = code;
}

server?.kill();
process.exit(exitCode);
