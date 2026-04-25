import { createReadStream, existsSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';

const API_PORT = Number.parseInt(process.env.HAPPENED_API_PORT ?? process.env.API_PORT ?? '4017', 10);
const PROXY_PORT = Number.parseInt(process.env.HAPPENED_PROXY_PORT ?? '8297', 10);
const WEB_DIR = path.join(process.cwd(), '.local', 'web-preview');

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

let proxyServer = null;
const children = [];

function waitForHttp(url, timeoutMs = 30000) {
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
      req.setTimeout(1500, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(attempt, 500);
    };

    attempt();
  });
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

function proxyRequest(req, res) {
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port: API_PORT,
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

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  if (proxyServer) {
    proxyServer.close();
  }

  setTimeout(() => process.exit(code), 200);
}

if (!existsSync(path.join(WEB_DIR, 'index.html'))) {
  throw new Error(`Missing ${WEB_DIR}. Build the web preview before starting this server.`);
}

const api = spawn('npm', ['run', 'api'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    API_HOST: '127.0.0.1',
    API_PORT: String(API_PORT),
  },
});
children.push(api);
api.on('exit', (code, signal) => {
  console.log(`[happened] api exited${signal ? ` with ${signal}` : ` with code ${code}`}`);
  shutdown(code ?? 1);
});

await waitForHttp(`http://127.0.0.1:${API_PORT}/health`);

proxyServer = http.createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;

  if (pathname === '/health' || pathname.startsWith('/v1/') || pathname.startsWith('/uploads/')) {
    proxyRequest(req, res);
    return;
  }

  serveStatic(req, res);
});

proxyServer.listen(PROXY_PORT, '127.0.0.1', () => {
  console.log(`[happened] preview proxy ready: http://127.0.0.1:${PROXY_PORT}`);
  console.log(`[happened] api health: http://127.0.0.1:${PROXY_PORT}/health`);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
