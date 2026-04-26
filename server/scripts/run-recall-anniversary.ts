// server/scripts/run-recall-anniversary.ts
// 수동 실행: npm run recall:anniversary
// Anniversary recall_events 를 오늘 기준으로 생성한다 (cron 없이 수동 트리거).

import 'dotenv/config';

import { generateAnniversaryRecalls } from '../recall';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL 환경변수가 필요합니다.');
    process.exit(1);
  }

  const now = new Date();
  console.log(`[recall:anniversary] 시작 — ${now.toISOString()}`);

  const result = await generateAnniversaryRecalls(databaseUrl, now);
  console.log(`[recall:anniversary] 완료 — 생성: ${result.created}, 스킵: ${result.skipped}`);
}

main().catch((err) => {
  console.error('[recall:anniversary] 오류:', err);
  process.exit(1);
});
