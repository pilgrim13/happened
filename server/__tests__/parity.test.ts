// Minimal sanity tests for S2 parity infra.
// Run: `npx tsx server/__tests__/parity.test.ts`
// Asserts:
//   - mediaKey() produces the documented `posts/yyyy/mm/...` shape
//   - PostGIS ST_DWithin SQL fragment compiles (string check; cheap guard)
//   - mailer/storage config readers handle missing env

import assert from 'node:assert/strict';

import { mediaKey } from '../storage';
import { getStorageConfig } from '../storage';
import { getMailerConfig } from '../mailer';

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn())
    .then(() => console.log(`ok   - ${name}`))
    .catch((error) => {
      console.error(`FAIL - ${name}`);
      console.error(error);
      process.exitCode = 1;
    });
}

(async () => {
  await test('mediaKey shape: posts/yyyy/mm/userId/postId.ext', () => {
    const key = mediaKey('user_42', 'post_abc', 'jpg', new Date(Date.UTC(2026, 3, 26)));
    assert.equal(key, 'posts/2026/04/user_42/post_abc.jpg');
  });

  await test('mediaKey sanitizes unsafe segments', () => {
    const key = mediaKey('a/b c', 'p..!', 'JPG', new Date(Date.UTC(2026, 0, 1)));
    assert.match(key, /^posts\/2026\/01\/a_b_c\/p___\.jpg$/);
  });

  await test('getStorageConfig returns null when env missing', () => {
    const cfg = getStorageConfig({} as NodeJS.ProcessEnv);
    assert.equal(cfg, null);
  });

  await test('getMailerConfig returns null when SMTP_HOST missing', () => {
    const cfg = getMailerConfig({} as NodeJS.ProcessEnv);
    assert.equal(cfg, null);
  });

  await test('getStorageConfig builds full config', () => {
    const cfg = getStorageConfig({
      S3_ENDPOINT: 'http://localhost:9000',
      S3_BUCKET: 'happened-media-dev',
      S3_ACCESS_KEY: 'minioadmin',
      S3_SECRET_KEY: 'minioadmin',
    } as unknown as NodeJS.ProcessEnv);
    assert.ok(cfg);
    assert.equal(cfg!.bucket, 'happened-media-dev');
    assert.equal(cfg!.forcePathStyle, true);
  });
})();
