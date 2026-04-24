import { spawn } from 'node:child_process';
import net from 'node:net';

const BASE_PORT = Number.parseInt(process.env.HAPPENED_PORT ?? '8097', 10);
const MAX_SCAN = 40;

function canUsePort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findPort() {
  for (let offset = 0; offset < MAX_SCAN; offset += 1) {
    const port = BASE_PORT + offset;
    if (await canUsePort(port)) {
      return port;
    }
  }

  throw new Error(`No open port found from ${BASE_PORT} to ${BASE_PORT + MAX_SCAN - 1}`);
}

const port = await findPort();
const passthroughArgs = process.argv.slice(2);
const args = ['expo', 'start', '--port', String(port), ...passthroughArgs];

console.log(`[happened] starting Expo on port ${port}`);

const child = spawn('npx', args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    EXPO_NO_TELEMETRY: '1',
  },
  shell: process.platform === 'win32',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }
  process.exit(code ?? 0);
});
