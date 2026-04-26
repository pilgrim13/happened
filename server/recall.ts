import { randomUUID } from 'node:crypto';

import { queryDatabase } from './db';

export type RecallEvent = {
  id: string;
  kind: 'anniversary' | 'proximity';
  sourcePostId: string | null;
  placeId: string | null;
  scheduledFor: string;
  deliveredAt: string | null;
  createdAt: string;
};

type DbRecallEventRow = {
  id: string;
  kind: string;
  source_post_id: string | null;
  place_id: string | null;
  scheduled_for: Date | string;
  delivered_at: Date | string | null;
  created_at: Date | string;
};

function rowToRecallEvent(row: DbRecallEventRow): RecallEvent {
  return {
    id: row.id,
    kind: row.kind as RecallEvent['kind'],
    sourcePostId: row.source_post_id,
    placeId: row.place_id,
    scheduledFor: new Date(row.scheduled_for).toISOString(),
    deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * 오늘(월/일)에 생성된 memory_posts 작성자를 위해 anniversary recall_events 를 생성한다.
 * 이미 동일 (source_post_id, 날짜) 조합이 있으면 skip.
 */
export async function generateAnniversaryRecalls(
  databaseUrl: string,
  now: Date = new Date(),
): Promise<{ created: number; skipped: number }> {
  // Asia/Seoul 기준 오늘의 월/일
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
  const parts = formatter.formatToParts(now);
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? '1');
  const day   = Number(parts.find((p) => p.type === 'day')?.value ?? '1');

  const todaySeoul = parts.find((p) => p.type === 'year')?.value
    + '-' + String(month).padStart(2, '0')
    + '-' + String(day).padStart(2, '0');

  // created_at 의 월/일이 오늘과 같은 게시물 (작성자 있는 것만)
  const postsResult = await queryDatabase<{ id: string; user_id: string; place_id: string | null }>(
    databaseUrl,
    `select id, user_id, place_id
       from memory_posts
      where user_id is not null
        and extract(month from created_at at time zone 'Asia/Seoul') = $1
        and extract(day   from created_at at time zone 'Asia/Seoul') = $2`,
    [month, day],
  );

  let created = 0;
  let skipped = 0;

  for (const post of postsResult.rows) {
    // 오늘 날짜에 이미 anniversary recall 이 있으면 스킵
    const existing = await queryDatabase<{ id: string }>(
      databaseUrl,
      `select id from recall_events
        where kind = 'anniversary'
          and source_post_id = $1
          and scheduled_for::date = $2::date`,
      [post.id, todaySeoul],
    );

    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }

    const scheduledFor = todaySeoul + 'T09:00:00+09:00';
    await queryDatabase(
      databaseUrl,
      `insert into recall_events (id, user_id, kind, source_post_id, place_id, scheduled_for, created_at)
       values ($1, $2, 'anniversary', $3, $4, $5, now())`,
      [randomUUID(), post.user_id, post.id, post.place_id ?? null, scheduledFor],
    );
    created++;
  }

  return { created, skipped };
}

export { rowToRecallEvent, type DbRecallEventRow };
