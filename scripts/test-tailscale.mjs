import { createReadStream, existsSync, statSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';

const API_BASE_PORT = Number.parseInt(process.env.HAPPENED_API_PORT ?? process.env.API_PORT ?? '4017', 10);
const PROXY_BASE_PORT = Number.parseInt(process.env.HAPPENED_PROXY_PORT ?? '8297', 10);
const FUNNEL_PORT = Number.parseInt(process.env.HAPPENED_FUNNEL_PORT ?? '10000', 10);
const WEB_DIR = path.join(process.cwd(), '.local', 'web-preview');
const MAX_SCAN = 40;

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

let shuttingDown = false;
let proxyServer = null;
let previousProxy = null;
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

function commandJson(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });

  if (result.status !== 0) {
    const message = result.stderr.trim() || result.stdout.trim() || `${command} failed`;
    throw new Error(message);
  }

  return JSON.parse(result.stdout);
}

function getTailscaleDnsName() {
  const status = commandJson('tailscale', ['status', '--json']);
  const dnsName = status?.Self?.DNSName;

  if (!dnsName) {
    throw new Error('Tailscale is not logged in on this machine.');
  }

  return dnsName.replace(/\.$/, '');
}

function getPreviousFunnelProxy(dnsName) {
  const result = spawnSync('tailscale', ['funnel', 'status', '--json'], { encoding: 'utf8' });

  if (result.status !== 0 || !result.stdout.trim()) {
    return null;
  }

  const status = JSON.parse(result.stdout);
  return status?.Web?.[`${dnsName}:${FUNNEL_PORT}`]?.Handlers?.['/']?.Proxy ?? null;
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

function spawnChild(label, command, args, env) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env,
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

function proxyRequest(targetPort, req, res) {
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port: targetPort,
      method: req.method,
      path: req.url,
      headers: req.headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstream.on('error', (error) => {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'bad_gateway', message: error.message }));
  });

  req.pipe(upstream);
}

function sendFile(filePath, res) {
  const extension = path.extname(filePath).toLowerCase();
  const stat = statSync(filePath);
  res.writeHead(200, {
    'content-type': contentTypes[extension] ?? 'application/octet-stream',
    'content-length': stat.size,
    'cache-control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  createReadStream(filePath).pipe(res);
}

function serveStatic(req, res) {
  const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
  const requestedPath = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  const normalizedPath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(WEB_DIR, normalizedPath);
  const indexPath = path.join(WEB_DIR, 'index.html');

  if (filePath.startsWith(WEB_DIR) && existsSync(filePath) && statSync(filePath).isFile()) {
    sendFile(filePath, res);
    return;
  }

  sendFile(indexPath, res);
}

function startProxy({ apiPort, proxyPort }) {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;

    if (pathname === '/health' || pathname.startsWith('/v1/') || pathname.startsWith('/uploads/')) {
      proxyRequest(apiPort, req, res);
      return;
    }

    serveStatic(req, res);
  });

  return new Promise((resolve) => {
    server.listen(proxyPort, '127.0.0.1', () => {
      proxyServer = server;
      resolve();
    });
  });
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`);
  }
}

async function buildWeb(publicUrl) {
  await rm(WEB_DIR, { recursive: true, force: true });
  run('npx', ['expo', 'export', '--platform', 'web', '--output-dir', WEB_DIR], {
    ...process.env,
    EXPO_NO_TELEMETRY: '1',
    EXPO_PUBLIC_HAPPENED_API_URL: publicUrl,
  });
}

function restorePreviousFunnel() {
  if (!previousProxy) {
    return;
  }

  try {
    run('tailscale', ['funnel', '--bg', '--yes', `--https=${FUNNEL_PORT}`, previousProxy]);
    console.log(`[happened] restored previous Tailscale Funnel target on :${FUNNEL_PORT}: ${previousProxy}`);
  } catch {
    console.log(`[happened] could not restore previous Tailscale Funnel target on :${FUNNEL_PORT}`);
  }
}

function shutdown(code = 0) {
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  if (proxyServer) {
    proxyServer.close();
  }

  restorePreviousFunnel();
  setTimeout(() => process.exit(code), 250);
}

const dnsName = getTailscaleDnsName();
const apiPort = await findPort(API_BASE_PORT);
const proxyPort = await findPort(PROXY_BASE_PORT);
const publicUrl = `https://${dnsName}:${FUNNEL_PORT}`;

previousProxy = getPreviousFunnelProxy(dnsName);

console.log('[happened] starting production-like Tailscale Funnel preview');
console.log(`[happened] public URL will be: ${publicUrl}`);

spawnChild('api', 'npm', ['run', 'api'], {
  ...process.env,
  API_HOST: '127.0.0.1',
  API_PORT: String(apiPort),
});
await waitForHttp(`http://127.0.0.1:${apiPort}/health`);

console.log('[happened] building static web preview');
await buildWeb(publicUrl);

await startProxy({ apiPort, proxyPort });
run('tailscale', ['funnel', '--bg', '--yes', `--https=${FUNNEL_PORT}`, `http://127.0.0.1:${proxyPort}`]);

console.log('');
console.log('[happened] Tailscale Funnel preview is ready');
console.log(`[happened] open on phone: ${publicUrl}`);
console.log(`[happened] API health: ${publicUrl}/health`);
console.log(`[happened] local proxy: http://127.0.0.1:${proxyPort}`);
console.log('[happened] keep this process running while testing. Ctrl+C restores the previous Funnel target for this port.');

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('SIGHUP', () => shutdown(0));
