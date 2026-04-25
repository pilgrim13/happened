import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';

const DEFAULT_PUBLIC_URL = 'https://euryhaline-lita-insupportably.ngrok-free.dev';
const DEFAULT_SCREEN_URL = 'http://127.0.0.1:8297';
const PUBLIC_URL = trimTrailingSlash(process.env.HAPPENED_PUBLIC_URL ?? DEFAULT_PUBLIC_URL);
const SCREEN_URL = trimTrailingSlash(process.env.HAPPENED_QA_SCREEN_URL ?? DEFAULT_SCREEN_URL);
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT_DIR = process.env.HAPPENED_QA_DIR ?? path.join('.local', 'qa');
const TINY_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(pathname, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${PUBLIC_URL}${pathname}`, {
    method,
    headers: {
      Accept: 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : null),
      ...(body ? { 'Content-Type': 'application/json' } : null),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = typeof payload?.message === 'string' ? payload.message : `${method} ${pathname} failed with ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

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

async function findPort(basePort = 9397) {
  for (let offset = 0; offset < 40; offset += 1) {
    const port = basePort + offset;
    if (await canUsePort(port)) {
      return port;
    }
  }

  throw new Error(`No open port found from ${basePort} to ${basePort + 39}`);
}

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

async function launchChrome(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(CHROME, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${path.resolve('.local', 'chrome-qa')}`,
      'about:blank',
    ], { stdio: 'ignore' });
    child.on('error', reject);
    child.once('spawn', () => resolve(child));
  });
}

async function openCdpPage(port, url) {
  await waitForHttp(`http://127.0.0.1:${port}/json/version`);
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT',
  });
  const target = await response.json();

  if (!target.webSocketDebuggerUrl) {
    throw new Error('Chrome did not return a DevTools websocket URL.');
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const events = new Map();

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data.toString());

    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        reject(new Error(message.error.message));
      } else {
        resolve(message.result);
      }
      return;
    }

    const listeners = events.get(message.method);
    if (listeners) {
      for (const listener of listeners) {
        listener(message.params);
      }
    }
  });

  function send(method, params = {}) {
    const id = nextId;
    nextId += 1;

    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  function once(method) {
    return new Promise((resolve) => {
      const listener = (params) => {
        events.set(method, (events.get(method) ?? []).filter((candidate) => candidate !== listener));
        resolve(params);
      };
      events.set(method, [...(events.get(method) ?? []), listener]);
    });
  }

  return { send, once, close: () => ws.close() };
}

async function captureMobileScreenshot({ url, filePath, width, height }) {
  const port = await findPort();
  const chrome = await launchChrome(port);

  try {
    const page = await openCdpPage(port, url);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: true,
    });
    const loaded = page.once('Page.loadEventFired');
    await page.send('Page.navigate', { url });
    await loaded;
    await page.send('Runtime.evaluate', {
      expression: 'document.fonts?.ready ?? true',
      awaitPromise: true,
    });
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const loadState = await page.send('Runtime.evaluate', {
        expression: `(() => {
          const text = document.body?.innerText ?? '';
          return {
            loading: text.includes('Loading post') || text.includes('Loading profile')
          };
        })()`,
        returnByValue: true,
      });

      if (!loadState.result.value.loading) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    await new Promise((resolve) => setTimeout(resolve, 700));

    const metrics = await page.send('Runtime.evaluate', {
      expression: `(() => {
        const root = document.getElementById('root');
        return {
          innerWidth: window.innerWidth,
          visualWidth: window.visualViewport?.width ?? window.innerWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          rootScrollWidth: root?.scrollWidth ?? 0
        };
      })()`,
      returnByValue: true,
    });
    const value = metrics.result.value;
    const maxScrollWidth = Math.max(value.documentScrollWidth, value.bodyScrollWidth, value.rootScrollWidth);
    assert(maxScrollWidth <= width + 1, `${path.basename(filePath)} has horizontal overflow: ${maxScrollWidth}px > ${width}px`);

    const screenshot = await page.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
      fromSurface: true,
    });
    await writeFile(filePath, Buffer.from(screenshot.data, 'base64'));
    page.close();
  } finally {
    chrome.kill('SIGTERM');
  }
}

async function assertMapDragWorks({ url, width, height }) {
  const port = await findPort();
  const chrome = await launchChrome(port);

  try {
    const page = await openCdpPage(port, url);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: true,
    });
    const loaded = page.once('Page.loadEventFired');
    await page.send('Page.navigate', { url });
    await loaded;
    await page.send('Runtime.evaluate', {
      expression: 'document.fonts?.ready ?? true',
      awaitPromise: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const before = await page.send('Runtime.evaluate', {
      expression: `(() => {
        const stage = document.querySelector('[data-testid="map-stage"]');
        const marker = document.querySelector('[data-testid="place-marker-seolleung"]');
        if (!stage || !marker) return null;
        const stageRect = stage.getBoundingClientRect();
        const markerRect = marker.getBoundingClientRect();
        return {
          startX: Math.round(stageRect.left + stageRect.width * 0.52),
          startY: Math.round(stageRect.top + stageRect.height * 0.46),
          markerX: Math.round(markerRect.left + markerRect.width / 2),
          markerY: Math.round(markerRect.top + markerRect.height / 2)
        };
      })()`,
      returnByValue: true,
    });
    const start = before.result.value;
    assert(start, 'Map drag QA could not find map stage or Seolleung marker.');

    await page.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: start.startX, y: start.startY, id: 1, radiusX: 3, radiusY: 3, force: 1 }],
    });
    await page.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: start.startX + 40, y: start.startY + 18, id: 1, radiusX: 3, radiusY: 3, force: 1 }],
    });
    await page.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: start.startX + 88, y: start.startY + 40, id: 1, radiusX: 3, radiusY: 3, force: 1 }],
    });
    await page.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const after = await page.send('Runtime.evaluate', {
      expression: `(() => {
        const marker = document.querySelector('[data-testid="place-marker-seolleung"]');
        if (!marker) return null;
        const rect = marker.getBoundingClientRect();
        return {
          markerX: Math.round(rect.left + rect.width / 2),
          markerY: Math.round(rect.top + rect.height / 2)
        };
      })()`,
      returnByValue: true,
    });
    const end = after.result.value;
    assert(end, 'Map marker disappeared after drag.');
    const moved = Math.hypot(end.markerX - start.markerX, end.markerY - start.markerY);
    assert(moved >= 32, `Map did not pan far enough after drag: marker moved ${moved.toFixed(1)}px.`);
    console.log('[qa] map drag interaction passed');
    page.close();
  } finally {
    chrome.kill('SIGTERM');
  }
}

async function assertMapAutoLocationWorks({ url, width, height }) {
  const port = await findPort();
  const chrome = await launchChrome(port);

  try {
    const page = await openCdpPage(port, url);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await page.send('Browser.grantPermissions', {
      origin: new URL(url).origin,
      permissions: ['geolocation'],
    });
    await page.send('Emulation.setGeolocationOverride', {
      latitude: 37.5047,
      longitude: 127.0491,
      accuracy: 9,
    });

    const loaded = page.once('Page.loadEventFired');
    await page.send('Page.navigate', { url });
    await loaded;
    await page.send('Runtime.evaluate', {
      expression: 'document.fonts?.ready ?? true',
      awaitPromise: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 1800));

    const result = await page.send('Runtime.evaluate', {
      expression: `(() => {
        const stage = document.querySelector('[data-testid="map-stage"]');
        const marker = document.querySelector('[data-testid="user-location-marker"]');
        if (!stage || !marker) {
          return { ok: false, reason: 'missing marker', text: document.body?.innerText ?? '' };
        }
        const stageRect = stage.getBoundingClientRect();
        const markerRect = marker.getBoundingClientRect();
        const markerX = markerRect.left + markerRect.width / 2;
        const markerY = markerRect.top + markerRect.height / 2;
        const stageX = stageRect.left + stageRect.width / 2;
        const stageY = stageRect.top + stageRect.height / 2;
        return {
          ok: true,
          text: document.body?.innerText ?? '',
          offset: Math.round(Math.hypot(markerX - stageX, markerY - stageY))
        };
      })()`,
      returnByValue: true,
    });
    const value = result.result.value;
    assert(value.ok, `Map auto-location marker missing. Body text: ${value.text}`);
    assert(value.text.includes('GPS 정확도') || value.text.includes('GPS accuracy'), 'Map did not show active GPS accuracy text.');
    assert(value.offset <= 24, `Map did not center on the granted location. Marker offset ${value.offset}px.`);
    console.log('[qa] map auto-location interaction passed');
    page.close();
  } finally {
    chrome.kill('SIGTERM');
  }
}

async function assertMapPinchZoomWorks({ url, width, height }) {
  const port = await findPort();
  const chrome = await launchChrome(port);

  try {
    const page = await openCdpPage(port, url);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: true,
    });
    const loaded = page.once('Page.loadEventFired');
    await page.send('Page.navigate', { url });
    await loaded;
    await page.send('Runtime.evaluate', {
      expression: 'document.fonts?.ready ?? true',
      awaitPromise: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const before = await page.send('Runtime.evaluate', {
      expression: `(() => {
        const stage = document.querySelector('[data-testid="map-stage"]');
        const tile = stage?.querySelector('img');
        if (!stage || !tile) return null;
        const rect = stage.getBoundingClientRect();
        const match = String(tile.src).match(/openstreetmap\\.org\\/(\\d+)\\//);
        return {
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2),
          zoom: match ? Number(match[1]) : null
        };
      })()`,
      returnByValue: true,
    });
    const start = before.result.value;
    assert(start?.zoom, 'Map pinch QA could not read the initial tile zoom.');

    await page.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: start.x - 24, y: start.y, id: 1, radiusX: 3, radiusY: 3, force: 1 },
        { x: start.x + 24, y: start.y, id: 2, radiusX: 3, radiusY: 3, force: 1 },
      ],
    });
    await page.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: start.x - 96, y: start.y, id: 1, radiusX: 3, radiusY: 3, force: 1 },
        { x: start.x + 96, y: start.y, id: 2, radiusX: 3, radiusY: 3, force: 1 },
      ],
    });
    await page.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await new Promise((resolve) => setTimeout(resolve, 600));

    const after = await page.send('Runtime.evaluate', {
      expression: `(() => {
        const stage = document.querySelector('[data-testid="map-stage"]');
        const tile = stage?.querySelector('img');
        const match = String(tile?.src ?? '').match(/openstreetmap\\.org\\/(\\d+)\\//);
        return match ? Number(match[1]) : null;
      })()`,
      returnByValue: true,
    });
    const endZoom = after.result.value;
    assert(endZoom && endZoom > start.zoom, `Map pinch did not zoom in. Before ${start.zoom}, after ${endZoom}.`);
    console.log('[qa] map pinch zoom interaction passed');
    page.close();
  } finally {
    chrome.kill('SIGTERM');
  }
}

async function assertBottomTabsAttached({ url, width, height }) {
  const port = await findPort();
  const chrome = await launchChrome(port);

  try {
    const page = await openCdpPage(port, url);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: true,
    });
    const loaded = page.once('Page.loadEventFired');
    await page.send('Page.navigate', { url });
    await loaded;
    await page.send('Runtime.evaluate', {
      expression: 'document.fonts?.ready ?? true',
      awaitPromise: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 900));
    const result = await page.send('Runtime.evaluate', {
      expression: `(() => {
        const tabs = document.querySelector('[data-testid="bottom-tabs"]');
        if (!tabs) return null;
        const rect = tabs.getBoundingClientRect();
        return {
          bottom: Math.round(rect.bottom),
          viewport: Math.round(window.visualViewport?.height ?? window.innerHeight)
        };
      })()`,
      returnByValue: true,
    });
    const value = result.result.value;
    assert(value, 'Bottom tabs QA could not find the tab bar.');
    assert(Math.abs(value.viewport - value.bottom) <= 1, `Bottom tabs are not attached to viewport bottom: ${value.bottom} vs ${value.viewport}.`);
    console.log('[qa] bottom tabs attachment passed');
    page.close();
  } finally {
    chrome.kill('SIGTERM');
  }
}

async function assertFeedMediaStaysInPlace({ url, width, height }) {
  const port = await findPort();
  const chrome = await launchChrome(port);

  try {
    const page = await openCdpPage(port, url);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: true,
    });
    const loaded = page.once('Page.loadEventFired');
    await page.send('Page.navigate', { url });
    await loaded;
    await page.send('Runtime.evaluate', {
      expression: 'document.fonts?.ready ?? true',
      awaitPromise: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 900));

    const target = await page.send('Runtime.evaluate', {
      expression: `(() => {
        const media = document.querySelector('[data-testid^="feed-media-"]');
        if (!media) return null;
        const rect = media.getBoundingClientRect();
        return {
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2)
        };
      })()`,
      returnByValue: true,
    });
    const point = target.result.value;
    assert(point, 'Feed media QA could not find a media frame.');

    await page.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: point.x, y: point.y, id: 1, radiusX: 3, radiusY: 3, force: 1 }],
    });
    await page.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const result = await page.send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body?.innerText ?? '';
        return {
          stillHome: text.includes('Happened'),
          openedDetail: text.includes('게시물 불러오는 중') || text.includes('Loading post') || text.includes('댓글') || text.includes('Replies')
        };
      })()`,
      returnByValue: true,
    });
    const value = result.result.value;
    assert(value.stillHome && !value.openedDetail, 'Tapping feed media unexpectedly opened the post detail screen.');
    console.log('[qa] feed media in-place interaction passed');
    page.close();
  } finally {
    chrome.kill('SIGTERM');
  }
}

async function assertCaptureDoesNotAutoPickFarPlace({ url, width, height }) {
  const port = await findPort();
  const chrome = await launchChrome(port);

  try {
    const page = await openCdpPage(port, url);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await page.send('Browser.grantPermissions', {
      origin: new URL(url).origin,
      permissions: ['geolocation'],
    });
    await page.send('Emulation.setGeolocationOverride', {
      latitude: 37.5665,
      longitude: 126.978,
      accuracy: 10,
    });
    const loaded = page.once('Page.loadEventFired');
    await page.send('Page.navigate', { url });
    await loaded;
    await page.send('Runtime.evaluate', {
      expression: 'document.fonts?.ready ?? true',
      awaitPromise: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 1800));

    const result = await page.send('Runtime.evaluate', {
      expression: `(() => document.body?.innerText ?? '')()`,
      returnByValue: true,
    });
    const text = result.result.value;
    assert(text.includes('현재 위치 주변') || text.includes('게시 가능한 장소 없음'), 'Capture did not show current-location/no-place state for a far GPS location.');
    assert(!text.includes('대치 학교 운동장'), 'Capture auto-selected Daechi School Yard even though GPS was outside its upload radius.');
    assert(!text.includes('Current distance is'), 'Capture displayed an untranslated English distance error.');
    console.log('[qa] capture far-location auto-place guard passed');
    page.close();
  } finally {
    chrome.kill('SIGTERM');
  }
}

async function runApiQa() {
  const health = await request('/health');
  assert(health.ok, 'Health check did not return ok.');
  assert(health.database?.configured, 'Database is not configured.');
  assert(health.database?.ok, `Database is not reachable: ${health.database?.message ?? 'unknown error'}`);
  assert(health.media?.configured && health.media?.ok, `Media storage is not healthy: ${health.media?.message ?? 'unknown error'}`);

  const defaultLogin = await request('/v1/auth/login', {
    method: 'POST',
    body: {
      email: 'test@happened.dev',
      password: 'happened-test-1',
    },
  });
  assert(defaultLogin.data?.token, 'Default login did not return a session token.');

  const defaultSession = await request('/v1/auth/session', { token: defaultLogin.data.token });
  assert(defaultSession.data?.user?.email === 'test@happened.dev', 'Default session did not resolve to the test user.');

  const stamp = Date.now();
  const qaRegister = await request('/v1/auth/register', {
    method: 'POST',
    body: {
      email: `qa${stamp}@happened.test`,
      displayName: `QA ${String(stamp).slice(-4)}`,
      handle: `qa${stamp}`,
      password: 'happened-test-1',
    },
  });
  const qaToken = qaRegister.data?.token;
  assert(qaToken, 'QA registration did not return a session token.');

  const places = await request('/v1/places');
  assert(Array.isArray(places.data) && places.data.length > 0, 'Places API returned no places.');

  const feed = await request('/v1/feed', { token: qaToken });
  assert(Array.isArray(feed.data) && feed.data.length > 0, 'Feed API returned no posts.');
  const lockedPost = feed.data.find((post) => post.unlockState === 'locked');
  assert(!lockedPost || (!lockedPost.caption && !lockedPost.mediaUrl && (!lockedPost.mediaUrls || lockedPost.mediaUrls.length === 0)), 'Locked feed post leaked caption or media URLs.');
  const targetPost = feed.data[0];

  const echo = await request(`/v1/posts/${encodeURIComponent(targetPost.id)}/actions`, {
    method: 'POST',
    token: qaToken,
    body: { action: 'echo' },
  });
  assert(echo.data?.echoed === true && echo.data?.post?.viewer?.echoed === true, 'Echo action did not persist viewer state.');

  const save = await request(`/v1/posts/${encodeURIComponent(targetPost.id)}/actions`, {
    method: 'POST',
    token: qaToken,
    body: { action: 'save' },
  });
  assert(save.data?.saved === true && save.data?.post?.viewer?.saved === true, 'Save action did not persist viewer state.');

  const reply = await request(`/v1/posts/${encodeURIComponent(targetPost.id)}/actions`, {
    method: 'POST',
    token: qaToken,
    body: { action: 'reply', body: `QA reply ${stamp}` },
  });
  assert(reply.data?.message === 'Reply posted', 'Reply action did not complete.');

  const report = await request(`/v1/posts/${encodeURIComponent(targetPost.id)}/actions`, {
    method: 'POST',
    token: qaToken,
    body: { action: 'report', body: `QA report ${stamp}` },
  });
  assert(report.data?.post?.viewer?.reported === true, 'Report action did not persist viewer state.');

  await request(`/v1/posts/${encodeURIComponent(targetPost.id)}/actions`, {
    method: 'POST',
    token: qaToken,
    body: { action: 'hide' },
  });
  const hiddenFeed = await request('/v1/feed', { token: qaToken });
  assert(!hiddenFeed.data.some((post) => post.id === targetPost.id), 'Hidden post still appears in the viewer feed.');

  const placeName = places.data[0].placeName ?? places.data[0].name;
  const checkIn = await request('/v1/check-ins', {
    method: 'POST',
    token: qaToken,
    body: {
      placeName,
      distanceMeters: 0,
    },
  });
  assert(checkIn.data?.id, 'Check-in did not return a token id.');

  const memory = await request('/v1/memories', {
    method: 'POST',
    token: qaToken,
    body: {
      checkInTokenId: checkIn.data.id,
      caption: `QA memory ${stamp}`,
      visibility: 'PublicAfter1h',
      mediaItems: [
        { mediaDataUrl: TINY_PNG_DATA_URL, mediaFileName: 'qa-memory-1.png' },
        { mediaDataUrl: TINY_PNG_DATA_URL, mediaFileName: 'qa-memory-2.png' },
      ],
    },
  });
  assert(memory.data?.memory?.caption === `QA memory ${stamp}`, 'Memory creation did not return the created memory.');
  assert(memory.data?.memory?.mediaUrl, 'Memory creation did not return a stored media URL.');
  assert(memory.data?.memory?.mediaUrls?.length === 2, 'Memory creation did not preserve all uploaded media URLs.');
  assert(memory.data?.memory?.visibility === 'PublicAfter1h', 'Memory creation did not keep the default scheduled public visibility.');
  assert(memory.data?.checkInToken?.uploadsRemaining === 2, 'Memory upload did not spend one token upload.');

  const mediaResponse = await fetch(`${PUBLIC_URL}${memory.data.memory.mediaUrl}`, {
    headers: {
      'ngrok-skip-browser-warning': 'true',
    },
  });
  assert(mediaResponse.ok && mediaResponse.headers.get('content-type')?.startsWith('image/'), 'Uploaded media URL did not return an image.');

  const memories = await request('/v1/feed?mode=Memories', { token: qaToken });
  assert(memories.data.some((post) => post.id === memory.data.memory.id), 'Created memory is missing from Memories feed.');

  const following = await request('/v1/feed?mode=Following', { token: qaToken });
  assert(following.data.some((post) => post.id === memory.data.memory.id), 'Created memory is missing from the main Following feed.');

  const viewerRegister = await request('/v1/auth/register', {
    method: 'POST',
    body: {
      email: `viewer${stamp}@happened.test`,
      displayName: `Viewer ${String(stamp).slice(-4)}`,
      handle: `viewer${stamp}`,
      password: 'happened-test-1',
    },
  });
  const viewerToken = viewerRegister.data?.token;
  assert(viewerToken, 'Viewer registration did not return a session token.');
  const viewerFeed = await request('/v1/feed?mode=Following', { token: viewerToken });
  const postForOtherUser = viewerFeed.data.find((post) => post.id === memory.data.memory.id);
  assert(postForOtherUser, 'A second account cannot see the newly created post in the main feed.');
  assert(postForOtherUser.authorId === qaRegister.data.user.id, 'The other account sees the post with the wrong author.');

  const authorProfile = await request(`/v1/users/${encodeURIComponent(qaRegister.data.user.handle)}`, { token: viewerToken });
  assert(authorProfile.data?.user?.handle === qaRegister.data.user.handle, 'Author profile did not load for the second account.');
  assert(authorProfile.data?.viewer?.isFollowing === false, 'Second account unexpectedly starts as following the author.');

  const follow = await request(`/v1/users/${encodeURIComponent(qaRegister.data.user.handle)}/follow`, {
    method: 'POST',
    token: viewerToken,
  });
  assert(follow.data?.following === true && follow.data?.profile?.viewer?.isFollowing === true, 'Follow action did not persist viewer state.');

  const authorConnections = await request(`/v1/users/${encodeURIComponent(qaRegister.data.user.handle)}/connections`, { token: viewerToken });
  assert(
    authorConnections.data?.followers?.some((user) => user.handle === viewerRegister.data.user.handle && user.viewer.isSelf === true),
    'Author connections did not include the new follower.',
  );

  const socialReplyBody = `QA social reply ${stamp}`;
  await request(`/v1/posts/${encodeURIComponent(memory.data.memory.id)}/actions`, {
    method: 'POST',
    token: viewerToken,
    body: { action: 'reply', body: socialReplyBody },
  });

  const postDetail = await request(`/v1/posts/${encodeURIComponent(memory.data.memory.id)}`, { token: viewerToken });
  const socialReply = postDetail.data?.comments?.find((comment) => comment.body === socialReplyBody);
  assert(socialReply?.id, 'Post detail did not include the cross-account reply.');
  assert(socialReply.canDelete === true, 'Reply author cannot delete their own reply.');

  const authorNotifications = await request('/v1/notifications', { token: qaToken });
  assert(
    authorNotifications.data?.some((notification) => notification.type === 'reply' && notification.postId === memory.data.memory.id),
    'Author notifications did not include the new reply.',
  );
  assert(
    authorNotifications.data?.some((notification) => notification.type === 'follow' && notification.actor.handle === viewerRegister.data.user.handle),
    'Author notifications did not include the new follower.',
  );
  assert(
    authorNotifications.data?.some((notification) => notification.read === false),
    'Author notifications did not include unread state.',
  );

  const search = await request(`/v1/search?q=${encodeURIComponent(`QA memory ${stamp}`)}`, { token: viewerToken });
  assert(search.data?.posts?.some((post) => post.id === memory.data.memory.id), 'Search did not find the newly created memory.');
  const userSearch = await request(`/v1/search?q=${encodeURIComponent(qaRegister.data.user.handle)}`, { token: viewerToken });
  assert(userSearch.data?.users?.some((user) => user.handle === qaRegister.data.user.handle), 'Search did not find the newly created user.');
  const placeSearch = await request(`/v1/search?q=${encodeURIComponent(placeName)}`, { token: viewerToken });
  assert(placeSearch.data?.places?.some((place) => (place.placeName ?? place.name) === placeName), 'Search did not find the checked-in place.');

  const readNotifications = await request('/v1/notifications/read', {
    method: 'POST',
    token: qaToken,
  });
  assert(
    readNotifications.data?.length && readNotifications.data.every((notification) => notification.read === true),
    'Notification read endpoint did not mark visible notifications as read.',
  );

  const deletedDetail = await request(`/v1/posts/${encodeURIComponent(memory.data.memory.id)}/comments/${encodeURIComponent(socialReply.id)}`, {
    method: 'DELETE',
    token: viewerToken,
  });
  assert(
    !deletedDetail.data?.comments?.some((comment) => comment.id === socialReply.id),
    'Deleted reply still appears in post detail.',
  );

  const block = await request(`/v1/users/${encodeURIComponent(qaRegister.data.user.handle)}/block`, {
    method: 'POST',
    token: viewerToken,
  });
  assert(block.data?.blocked === true && block.data?.profile?.viewer?.isBlocked === true, 'Block action did not persist viewer state.');

  const blockedFeed = await request('/v1/feed?mode=Following', { token: viewerToken });
  assert(
    !blockedFeed.data.some((post) => post.id === memory.data.memory.id),
    'Blocked author still appears in the viewer feed.',
  );

  const safety = await request('/v1/me/safety', { token: viewerToken });
  assert(safety.data?.blockedCount >= 1, 'Safety summary did not include the blocked account.');

  const unblock = await request(`/v1/users/${encodeURIComponent(qaRegister.data.user.handle)}/block`, {
    method: 'POST',
    token: viewerToken,
  });
  assert(unblock.data?.blocked === false && unblock.data?.profile?.viewer?.isBlocked === false, 'Unblock action did not clear viewer state.');

  const updatedHandle = `qaedit${stamp}`;
  const updatedProfile = await request('/v1/me/profile', {
    method: 'PATCH',
    token: qaToken,
    body: {
      displayName: `QA Edited ${String(stamp).slice(-4)}`,
      handle: updatedHandle,
      bio: 'QA profile bio',
      avatarDataUrl: TINY_PNG_DATA_URL,
      avatarFileName: 'qa-avatar.png',
    },
  });
  assert(updatedProfile.data?.session?.user?.handle === updatedHandle, 'Profile update did not return the updated session handle.');
  assert(updatedProfile.data?.profile?.user?.displayName?.startsWith('QA Edited'), 'Profile update did not return the updated profile name.');
  assert(updatedProfile.data?.profile?.user?.bio === 'QA profile bio', 'Profile update did not return the updated bio.');
  assert(updatedProfile.data?.profile?.user?.avatarUrl, 'Profile update did not return an avatar URL.');

  const renamedProfile = await request(`/v1/users/${encodeURIComponent(updatedHandle)}`, { token: viewerToken });
  assert(
    renamedProfile.data?.posts?.some((post) => post.id === memory.data.memory.id && post.authorHandle === `@${updatedHandle}`),
    'Profile update did not refresh author metadata on existing posts.',
  );

  const postUpdate = await request(`/v1/posts/${encodeURIComponent(memory.data.memory.id)}`, {
    method: 'PATCH',
    token: qaToken,
    body: {
      caption: `QA edited memory ${stamp}`,
      visibility: 'Public',
    },
  });
  assert(
    postUpdate.data?.post?.caption === `QA edited memory ${stamp}` && postUpdate.data?.post?.visibility === 'Public',
    'Post update did not persist caption and visibility.',
  );

  const postDelete = await request(`/v1/posts/${encodeURIComponent(memory.data.memory.id)}`, {
    method: 'DELETE',
    token: qaToken,
  });
  assert(postDelete.data?.postId === memory.data.memory.id, 'Post delete did not return the deleted post id.');

  const deletedFeed = await request('/v1/feed?mode=Memories', { token: qaToken });
  assert(!deletedFeed.data.some((post) => post.id === memory.data.memory.id), 'Deleted post still appears in feed.');

  console.log('[qa] API/auth/feed/action/check-in/memory/social flow passed');
}

async function runScreenshotQa() {
  await mkdir(OUT_DIR, { recursive: true });

  const screens = [
    { name: 'welcome-390x844', width: 390, height: 844, query: 'lang=ko&stage=welcome' },
    { name: 'auth-390x844', width: 390, height: 844, query: 'lang=ko&stage=auth' },
    { name: 'permissions-390x844', width: 390, height: 844, query: 'lang=ko&stage=permissions' },
    { name: 'tutorial-390x844', width: 390, height: 844, query: 'lang=ko&stage=app&tutorial=1' },
    { name: 'home-390x844', width: 390, height: 844, query: 'lang=ko&stage=app&screen=home' },
    { name: 'post-detail-390x844', width: 390, height: 844, query: 'lang=ko&stage=app&postId=seolleung-cafe-2023' },
    { name: 'user-profile-390x844', width: 390, height: 844, query: 'lang=ko&stage=app&profile=junn' },
    { name: 'map-390x844', width: 390, height: 844, query: 'lang=ko&stage=app&screen=map' },
    { name: 'capture-390x844', width: 390, height: 844, query: 'lang=ko&stage=app&screen=capture' },
    { name: 'timeline-390x844', width: 390, height: 844, query: 'lang=ko&stage=app&screen=timeline' },
    { name: 'profile-430x932', width: 430, height: 932, query: 'lang=ko&stage=app&screen=profile' },
  ];

  for (const screen of screens) {
    const filePath = path.join(OUT_DIR, `${screen.name}.png`);
    await captureMobileScreenshot({
      url: `${SCREEN_URL}?${screen.query}`,
      filePath,
      width: screen.width,
      height: screen.height,
    });

    const info = await stat(filePath);
    assert(info.size > 10_000, `${filePath} looks too small to be a valid app screenshot.`);
    console.log(`[qa] screenshot ${filePath}`);
  }

  await assertMapDragWorks({
    url: `${SCREEN_URL}?lang=ko&stage=app&screen=map`,
    width: 390,
    height: 844,
  });
  await assertMapAutoLocationWorks({
    url: `${SCREEN_URL}?lang=ko&stage=app&screen=map`,
    width: 390,
    height: 844,
  });
  await assertMapPinchZoomWorks({
    url: `${SCREEN_URL}?lang=ko&stage=app&screen=map`,
    width: 390,
    height: 844,
  });
  await assertBottomTabsAttached({
    url: `${SCREEN_URL}?lang=ko&stage=app&screen=home`,
    width: 390,
    height: 844,
  });
  await assertFeedMediaStaysInPlace({
    url: `${SCREEN_URL}?lang=ko&stage=app&screen=home`,
    width: 390,
    height: 844,
  });
  await assertCaptureDoesNotAutoPickFarPlace({
    url: `${SCREEN_URL}?lang=ko&stage=app&screen=capture`,
    width: 390,
    height: 844,
  });
}

await runApiQa();

try {
  await runScreenshotQa();
  console.log('[qa] mobile web screenshot smoke passed');
} catch (error) {
  console.error(`[qa] screenshot smoke failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
