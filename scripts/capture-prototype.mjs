import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';

const BASE_PORT = Number.parseInt(process.env.HAPPENED_CAPTURE_PORT ?? '8197', 10);
const OUT_DIR = process.env.HAPPENED_CAPTURE_DIR ?? 'reports/260424-004-actual-app-screenshots/assets';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const screens = [
  { name: 'home-open', query: 'capture=1&screen=home&homePost=0' },
  { name: 'home-locked', query: 'capture=1&screen=home&homePost=1' },
  { name: 'map', query: 'capture=1&screen=map' },
  { name: 'capture', query: 'capture=1&screen=capture' },
  { name: 'timeline', query: 'capture=1&screen=timeline' },
  { name: 'profile', query: 'capture=1&screen=profile' },
];

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
  for (let offset = 0; offset < 40; offset += 1) {
    const port = BASE_PORT + offset;
    if (await canUsePort(port)) {
      return port;
    }
  }

  throw new Error(`No open port found from ${BASE_PORT} to ${BASE_PORT + 39}`);
}

function waitForHttp(url, timeoutMs = 120000) {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve();
        } else {
          retry();
        }
      });

      req.on('error', retry);
      req.setTimeout(2500, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(attempt, 1000);
    };

    attempt();
  });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with ${code}`));
      }
    });
  });
}

const port = await findPort();
await mkdir(OUT_DIR, { recursive: true });

const server = spawn('npx', ['expo', 'start', '--web', '--port', String(port)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    EXPO_NO_TELEMETRY: '1',
    BROWSER: 'none',
  },
});

try {
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHttp(baseUrl);

  // Let Metro finish the first web bundle before capturing.
  await new Promise((resolve) => setTimeout(resolve, 4500));

  for (const screen of screens) {
    const filePath = path.join(OUT_DIR, `${screen.name}.png`);
    const url = `${baseUrl}?${screen.query}`;
    await run(CHROME, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--window-size=390,844',
      '--virtual-time-budget=5000',
      `--screenshot=${filePath}`,
      url,
    ]);
    console.log(`[capture] ${filePath}`);
  }
} finally {
  server.kill('SIGTERM');
}
