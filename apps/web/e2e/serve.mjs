// Starts the production server for the E2E run and copies everything it prints into a log file
// (UF_E2E_SERVER_LOG), so the journeys can assert the server logged no unhandled error (audit
// A1-10). Playwright still shows the server's stderr as before.
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

const port = process.argv[2] ?? '3100';
const logPath = process.env.UF_E2E_SERVER_LOG;
if (!logPath) throw new Error('UF_E2E_SERVER_LOG is not set');
mkdirSync(dirname(logPath), { recursive: true });
const log = createWriteStream(logPath, { flags: 'w' });

const next = createRequire(import.meta.url).resolve('next/dist/bin/next');
const server = spawn(process.execPath, [next, 'start', '--port', port], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: process.env,
});
server.stdout.on('data', (chunk) => {
  log.write(chunk);
  process.stdout.write(chunk);
});
server.stderr.on('data', (chunk) => {
  log.write(chunk);
  process.stderr.write(chunk);
});
server.on('exit', (code) => {
  log.end();
  process.exit(code ?? 0);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}
