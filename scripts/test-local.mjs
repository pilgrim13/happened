import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';

const API_BASE_PORT = Number.parseInt(process.env.HAPPENED_API_PORT ?? process.env.API_PORT ?? '4017', 10);
const EXPO_BASE_PORT = Number.parseInt(process.env.HAPPENED_PORT ?? '8097', 10);
const MAX_SCAN = 40;
const nativeMode = process.argv.includes('--native');

function canUsePort(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function findPort(basePort, host) {
  for (let offset = 0; offset < MAX_SCAN; offset += 1) {
    const port = basePort + offset;
    if (await canUsePort(port, host)) {
      return port;
    }
  }

  throw new Error(`No open port found from ${basePort} to ${basePort + MAX_SCAN - 1}`);
}

function getLanAddress() {
  const interfaces = os.networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }

  return '127.0.0.1';
}

function spawnChild(label, command, args, env) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    console.log(`[happened] ${label} exited${signal ? ` with ${signal}` : ` with code ${code}`}`);
    shutdown(code ?? 1);
  });

  return child;
}

let shuttingDown = false;
const children = [];

function shutdown(code = 0) {
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => process.exit(code), 250);
}

const lanAddress = getLanAddress();
const apiPort = await findPort(API_BASE_PORT, '0.0.0.0');
const expoPort = await findPort(EXPO_BASE_PORT, '0.0.0.0');
const apiUrlForDevice = `http://${lanAddress}:${apiPort}`;

console.log('[happened] starting local test stack');
console.log(`[happened] API on this Mac: http://127.0.0.1:${apiPort}/health`);
console.log(`[happened] API for iPhone: ${apiUrlForDevice}/health`);

if (nativeMode) {
  console.log('[happened] Expo Go can scan the QR code printed by Expo below.');
  console.log('[happened] Press w in this terminal if you also want to open the web build.');
} else {
  console.log(`[happened] Web on this Mac: http://127.0.0.1:${expoPort}`);
  console.log(`[happened] Web for iPhone browser: http://${lanAddress}:${expoPort}`);
}

children.push(
  spawnChild('api', 'npm', ['run', 'api'], {
    ...process.env,
    API_HOST: '0.0.0.0',
    API_PORT: String(apiPort),
  }),
);

children.push(
  spawnChild('expo', 'npx', ['expo', 'start', ...(nativeMode ? [] : ['--web']), '--host', 'lan', '--port', String(expoPort)], {
    ...process.env,
    BROWSER: process.env.BROWSER ?? 'none',
    EXPO_NO_TELEMETRY: '1',
    EXPO_PUBLIC_HAPPENED_API_URL: apiUrlForDevice,
  }),
);

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
