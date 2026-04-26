# Happened API Reference

Base URL (개발): `http://127.0.0.1:4017`

인증이 필요한 엔드포인트는 `Authorization: Bearer <session-token>` 헤더를 포함해야 한다.

---

## Health

### `GET /health`
서비스 상태 확인. 인증 불필요.

**응답**
```json
{ "ok": true, "service": "happened-api", "environment": "development", "database": true, "media": true }
```

---

## Auth

모든 `/v1/auth/*` 엔드포인트는 별도의 낮은 레이트 리밋(`RATE_LIMIT_AUTH_MAX`, 기본 10 req/min)이 적용된다.

### `POST /v1/auth/register`
계정 생성.

**요청 바디**
```json
{
  "email": "string (email, max 180)",
  "displayName": "string (1–80)",
  "handle": "string (2–32, [a-zA-Z0-9_.])",
  "password": "string (min 8, 영문+숫자 조합 또는 12자 이상)"
}
```

**응답** `201` — 세션 객체 (`data: Session`)

---

### `POST /v1/auth/login`
로그인.

**요청 바디**
```json
{ "email": "string", "password": "string" }
```

**응답** `200` — 세션 객체 (`data: Session`)

---

### `POST /v1/auth/logout`
현재 세션 로그아웃. 인증 필요.

**응답** `200` — `{ data: { ok: true } }`

---

### `GET /v1/auth/session`
현재 세션 정보 조회. 인증 필요.

**응답** `200` — `{ data: Session }` / `401` 세션 만료

---

### `GET /v1/auth/sessions`
본인의 활성 세션 목록. 인증 필요.

**응답** `200` — `{ data: Session[] }` (user_agent, ip, last_seen_at, revoked_at 포함)

---

### `DELETE /v1/auth/sessions/:id`
특정 세션 취소. 인증 필요.

**응답** `200` — `{ data: { ok: true } }`

---

### `POST /v1/auth/verify-email/request`
이메일 인증 토큰 발급 및 발송. 인증 필요.
`SMTP_*` 환경변수가 설정된 경우 인증 링크 이메일을 발송한다 (개발: MailHog).

**응답** `200` — `{ data: { ok: true, expiresAt: "ISO8601" } }`

---

### `POST /v1/auth/verify-email/confirm`
이메일 인증 완료.

**요청 바디**
```json
{ "token": "string" }
```

**응답** `200` — `{ data: { ok: true } }` / `409` 토큰 만료·사용됨

---

### `POST /v1/auth/password-reset/request`
비밀번호 재설정 이메일 발송.

**요청 바디**
```json
{ "email": "string (email)" }
```

**응답** `200` — `{ data: { ok: true } }` (이메일 존재 여부 무관하게 동일 응답)

---

### `POST /v1/auth/password-reset/confirm`
새 비밀번호 설정.

**요청 바디**
```json
{ "token": "string", "password": "string (min 8)" }
```

**응답** `200` — `{ data: { ok: true } }` / `409` 토큰 만료·사용됨

---

## Media

### `POST /v1/media/presign`
S3 presigned PUT URL 발급. 인증 필요. `S3_*` 환경변수가 없으면 `503`.

**요청 바디**
```json
{
  "contentType": "image/jpeg | image/png | image/webp | image/heic | image/heif | video/mp4 | video/quicktime | video/webm",
  "contentLength": "number (bytes)",
  "kind": "photo | video (default: photo)",
  "ext": "string (optional, max 8)"
}
```

**응답** `200`
```json
{
  "data": {
    "uploadUrl": "https://...",
    "publicUrl": "https://...",
    "expiresAt": "ISO8601",
    "key": "posts/yyyy/mm/{userId}/{draftId}.{ext}"
  }
}
```

클라이언트는 `uploadUrl`로 직접 PUT 요청 후, 반환된 `key`를 `POST /v1/memories` 의 `mediaKeys` 필드에 전달한다.

---

### `GET /uploads/:fileName`
레거시 로컬 파일 서빙 (`MEDIA_STORAGE_DRIVER=local`). Range 요청 지원.

---

## Me (본인)

### `PATCH /v1/me/profile`
프로필 수정. 인증 필요. 최소 한 필드 이상 필요.

**요청 바디**
```json
{
  "displayName": "string (1–80, optional)",
  "handle": "string (2–32, optional)",
  "bio": "string (max 160, optional)",
  "avatarDataUrl": "string (data URL, max 12 MB, optional)",
  "avatarFileName": "string (optional)"
}
```

**응답** `200` — `{ data: Profile }`

---

### `GET /v1/me/safety`
차단/신고 현황 요약. 인증 필요.

**응답** `200` — `{ data: SafetySummary }`

---

## Feed

### `GET /v1/feed`
피드 조회. 인증 필요.

**쿼리 파라미터**
| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| `mode` | `Following \| Nearby \| Memories` | `Following` | 피드 모드 |
| `cursor` | string | — | 커서 기반 페이지네이션 |
| `limit` | number (1–100) | — | 페이지 크기 |

**응답** `200` — `{ data: { posts: Post[], nextCursor?: string } }`

---

## Search

### `GET /v1/search`
게시물·유저 검색. 인증 필요.

**쿼리 파라미터**: `q` (string, 1–120)

**응답** `200` — `{ data: SearchResult }`

---

## Posts

### `GET /v1/posts/:postId`
게시물 상세. 인증 필요.

**응답** `200` — `{ data: Post }` / `404`

---

### `PATCH /v1/posts/:postId`
캡션·공개범위 수정. 인증 필요 (작성자만).

**요청 바디** (최소 한 필드)
```json
{
  "caption": "string (1–500, optional)",
  "visibility": "Followers | PublicAfter1h | Public (optional)"
}
```

**응답** `200` — `{ data: Post }` / `403` 소유자 아님

---

### `DELETE /v1/posts/:postId`
게시물 삭제. 인증 필요 (작성자만).

**응답** `200` — `{ data: { ok: true } }`

---

### `POST /v1/posts/:postId/actions`
게시물 액션(에코·저장·댓글·숨기기·신고). 인증 필요.

**요청 바디**
```json
{
  "action": "echo | save | reply | hide | report",
  "body": "string (1–280, reply/report 시 필요)"
}
```

**응답** `200` — `{ data: ActionResult }`

---

### `DELETE /v1/posts/:postId/comments/:commentId`
댓글 삭제. 인증 필요 (댓글 작성자 또는 게시물 작성자).

**응답** `200` — `{ data: { ok: true } }`

---

## Users

### `GET /v1/users/:handle`
프로필 조회. 인증 필요.

**응답** `200` — `{ data: Profile }` / `404`

---

### `GET /v1/users/:handle/connections`
팔로워·팔로잉 목록. 인증 필요.

**응답** `200` — `{ data: { followers: User[], following: User[] } }`

---

### `POST /v1/users/:handle/follow`
팔로우 토글 (팔로우 ↔ 언팔로우). 인증 필요.

**응답** `200` — `{ data: { following: boolean } }` / `409` 자기 자신

---

### `POST /v1/users/:handle/block`
차단 토글. 인증 필요.

**응답** `200` — `{ data: { blocked: boolean } }` / `409` 자기 자신

---

## Notifications

### `GET /v1/notifications`
알림 목록. 인증 필요.

**응답** `200` — `{ data: Notification[] }`

---

### `POST /v1/notifications/read`
알림 읽음 처리. 인증 필요.

**요청 바디**
```json
{ "notificationIds": ["string", ...] }
```
`notificationIds` 생략 시 전체 읽음 처리.

**응답** `200` — `{ data: { ok: true } }`

---

## Places

### `GET /v1/places`
장소 전체 목록.

**응답** `200` — `{ data: Place[] }`

---

### `GET /v1/places/nearby`
반경 내 장소 검색 (PostGIS ST_DWithin + KNN). 인증 불필요.

**쿼리 파라미터**
| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| `lat` | number (-90–90) | 필수 | 위도 |
| `lng` | number (-180–180) | 필수 | 경도 |
| `radius` | number (max 100,000 m) | — | 검색 반경 (미터) |
| `limit` | number (1–100) | — | 최대 결과 수 |

**응답** `200` — `{ data: Place[] }` (가까운 순 정렬)

---

### `GET /v1/places/:placeKey`
장소 상세.

**응답** `200` — `{ data: Place }` / `404`

---

## Timeline

### `GET /v1/timeline`
전체 타임라인.

**응답** `200` — `{ data: TimelineEntry[] }`

---

## Check-ins

### `POST /v1/check-ins`
체크인 토큰 발급. 인증 필요. 반경 외부 또는 GPS 정확도 낮으면 `403`.

**요청 바디**
```json
{
  "placeName": "string (1–120)",
  "distanceMeters": "number (optional)",
  "location": {
    "latitude": "number",
    "longitude": "number",
    "accuracyMeters": "number | null (optional)"
  }
}
```

**응답** `201` — `{ data: CheckInToken }`

---

## Memories

### `POST /v1/memories`
메모리 게시물 생성. 인증 필요.

**요청 바디**
```json
{
  "checkInTokenId": "string",
  "caption": "string (1–500)",
  "visibility": "Followers | PublicAfter1h | Public (default: PublicAfter1h)",
  "mediaKeys": ["string", ...] // presigned 업로드 후 반환된 key (최대 6개, 권장)
}
```

> 레거시: `mediaDataUrl` / `mediaItems` (data URL 직접 업로드) — 비추천, `mediaKeys` 사용 권장.

`mediaKeys` 사용 시 `S3_*`가 설정되어 있어야 하며 MinIO에 객체가 존재해야 한다. 없으면 `400 media_missing`.

**응답** `201` — `{ data: Post }`

---

## 공통 에러 형식

```json
{ "error": "error_code", "message": "설명" }
```

주요 에러 코드: `auth_failed` (401), `post_not_found` / `place_not_found` / `profile_not_found` (404), `email_taken` / `handle_taken` / `token_expired` / `token_spent` (409), `outside_radius` / `post_owner_required` (403), `storage_unavailable` (503).
