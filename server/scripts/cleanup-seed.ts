// server/scripts/cleanup-seed.ts
// 시드 데이터 정리 스크립트
// 수동 실행: npx tsx server/scripts/cleanup-seed.ts

import 'dotenv/config';

import { queryDatabase } from '../db';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL 환경변수가 필요합니다.');
    process.exit(1);
  }

  console.log('[cleanup-seed] 시드 포스트 삭제 중...');
  const posts = await queryDatabase(databaseUrl, 'delete from memory_posts returning id');
  console.log(`[cleanup-seed] 포스트 ${posts.rowCount ?? 0}개 삭제 완료`);

  console.log('[cleanup-seed] 시드 장소 삭제 중 (created_by_user_id IS NULL)...');
  const places = await queryDatabase(databaseUrl, 'delete from places where created_by_user_id is null returning id');
  console.log(`[cleanup-seed] 장소 ${places.rowCount ?? 0}개 삭제 완료`);

  console.log('[cleanup-seed] 완료');
  process.exit(0);
}

main().catch((err) => {
  console.error('[cleanup-seed] 오류:', err);
  process.exit(1);
});
