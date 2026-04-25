import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';

const API_BASE_PORT = Number.parseInt(process.env.HAPPENED_API_PORT ?? process.env.API_PORT ?? '4017', 10);
const EXPO_BASE_PORT = Number.parseInt(process.env.HAPPENED_PORT ?? '8097', 10);
const MAX_SCAN = 40;

let shuttingDown = false;
const children = [];

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

async function findPort(basePort) {
  for (let offset = 0; offset < MAX_SCAN; offset += 1) {
    const port = basePort + offset;
    if (await canUsePort(port)) {
      return port;
    }
  }

  throw new Error(`No open port found from ${basePort} to ${basePort + MAX_SCAN - 1}`);
}

function waitForHttp(url, timeoutMs = 120000) {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve();
          return;
        }
        retry();
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

function spawnChild(label, command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: options.stdio ?? 'inherit',
    env: options.env ?? process.env,
    shell: process.platform === 'win32',
  });

  children.push(child);

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    console.log(`[happened] ${label} exited${signal ? ` with ${signal}` : ` with code ${code}`}`);
    shutdown(code ?? 1);
  });

  return child;
}

function startTunnel(label, port) {
  return new Promise((resolve, reject) => {
    const child = spawnChild(label, 'npx', ['--yes', 'localtunnel', '--port', String(port)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${label} public URL.`));
    }, 60000);

    const read = (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);

      const match = text.match(/https:\/\/[^\s]+\.loca\.lt/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[0]);
      }
    };

    child.stdout.on('data', read);
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  });
}

function shutdown(code = 0) {
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => process.exit(code), 250);
}

const apiPort = await findPort(API_BASE_PORT);
const expoPort = await findPort(EXPO_BASE_PORT);

console.log('[happened] starting public preview stack');

spawnChild('api', 'npm', ['run', 'api'], {
  env: {
    ...process.env,
    API_HOST: '127.0.0.1',
    API_PORT: String(apiPort),
  },
});

await waitForHttp(`http://127.0.0.1:${apiPort}/health`);
const apiUrl = await startTunnel('api tunnel', apiPort);

spawnChild('expo', 'npx', ['expo', 'start', '--web', '--host', 'localhost', '--port', String(expoPort)], {
  env: {
    ...process.env,
    BROWSER: process.env.BROWSER ?? 'none',
    EXPO_NO_TELEMETRY: '1',
    EXPO_PUBLIC_HAPPENED_API_URL: apiUrl,
  },
});

await waitForHttp(`http://127.0.0.1:${expoPort}`);
const webUrl = await startTunnel('web tunnel', expoPort);

console.log('');
console.log('[happened] public preview is ready');
console.log(`[happened] open on phone: ${webUrl}`);
console.log(`[happened] public API: ${apiUrl}/health`);
console.log('[happened] keep this process running while testing.');

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
