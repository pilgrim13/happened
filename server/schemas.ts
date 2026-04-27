import { z } from 'zod';

export const feedModeSchema = z.enum(['Following', 'Nearby', 'Memories']);
export const visibilitySchema = z.enum(['Followers', 'PublicAfter1h', 'Public']);
export const memoryPostActionSchema = z.enum(['echo', 'save', 'reply', 'hide', 'report']);

export const feedQuerySchema = z.object({
  mode: feedModeSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export const cursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const presignRequestSchema = z.object({
  contentType: z.string().trim().min(1).max(120),
  contentLength: z.coerce.number().int().positive().max(200 * 1024 * 1024),
  kind: z.enum(['photo', 'video']).default('photo'),
  ext: z.string().trim().max(8).optional(),
});

export const verifyEmailRequestSchema = z.object({});
export const verifyEmailConfirmSchema = z.object({ token: z.string().min(8).max(200) });
export const passwordResetRequestSchema = z.object({ email: z.string().trim().email().max(180) });
export const passwordResetConfirmSchema = z.object({
  token: z.string().min(8).max(200),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 해요').max(200, '비밀번호가 너무 깁니다'),
});

export const sessionParamsSchema = z.object({ id: z.string().min(1) });

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
});

export const placeParamsSchema = z.object({
  placeKey: z.string().min(1),
});

export const postParamsSchema = z.object({
  postId: z.string().min(1),
});

export const userParamsSchema = z.object({
  handle: z.string().trim().min(1).max(80),
});

export const commentParamsSchema = z.object({
  postId: z.string().min(1),
  commentId: z.string().min(1),
});

export const postActionRequestSchema = z.object({
  action: memoryPostActionSchema,
  body: z.string().trim().min(1).max(280).optional(),
});

export const notificationReadRequestSchema = z.object({
  notificationIds: z.array(z.string().trim().min(1)).max(100).optional(),
});

export const checkInRequestSchema = z.object({
  placeName: z.string().trim().min(1).max(120),
  distanceMeters: z.coerce.number().nonnegative().max(100000).optional(),
  location: z
    .object({
      latitude: z.coerce.number().min(-90).max(90),
      longitude: z.coerce.number().min(-180).max(180),
      accuracyMeters: z.coerce.number().nonnegative().max(10000).nullable().optional(),
    })
    .optional(),
});

export const placeCreateSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const memoryCreateRequestSchema = z.object({
  // 구형 체크인 토큰 기반 플로우 (optional로 변경)
  checkInTokenId: z.string().trim().min(1).optional(),
  // 신규 GPS 기반 플로우
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  placeName: z.string().trim().min(1).max(50).optional(),
  caption: z.string().trim().min(1, '문구를 입력해주세요').max(500, '문구는 500자 이하로 입력해주세요'),
  visibility: visibilitySchema.default('PublicAfter1h'),
  mediaDataUrl: z.string().max(64_000_000).optional(),
  mediaFileName: z.string().trim().max(140).optional(),
  mediaItems: z
    .array(z.object({
      mediaDataUrl: z.string().max(64_000_000),
      mediaFileName: z.string().trim().max(140).optional(),
    }))
    .min(1)
    .max(6)
    .optional(),
  mediaKeys: z.array(z.string().min(1).max(300)).min(1).max(6).optional(),
}).refine((value) => Boolean(value.mediaDataUrl || value.mediaItems?.length || value.mediaKeys?.length), {
  message: '사진 또는 동영상을 하나 이상 추가해주세요.',
}).refine((value) => Boolean(value.checkInTokenId || (value.lat !== undefined && value.lng !== undefined)), {
  message: '현장 인증 토큰 또는 위치 정보가 필요해요.',
});

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().positive().max(100_000).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const memoryUpdateRequestSchema = z
  .object({
    caption: z.string().trim().min(1, '문구를 입력해주세요').max(500, '문구는 500자 이하로 입력해주세요').optional(),
    visibility: visibilitySchema.optional(),
  })
  .refine((value) => value.caption !== undefined || value.visibility !== undefined, {
    message: '수정할 항목을 하나 이상 입력해주세요.',
  });

export const authRegisterRequestSchema = z.object({
  email: z.string().trim().email('이메일 형식이 올바르지 않아요').max(180, '이메일이 너무 깁니다'),
  displayName: z.string().trim().min(1, '이름을 입력해주세요').max(80, '이름은 80자 이하로 입력해주세요'),
  handle: z
    .string()
    .trim()
    .min(2, '닉네임은 2자 이상이어야 해요')
    .max(32, '닉네임은 32자 이하로 입력해주세요')
    .regex(/^[\p{L}\p{N}_.]+$/u, '닉네임은 한글/영문/숫자/언더스코어/점만 사용 가능합니다.'),
  // Add a refined password schema for register
  password: z.string().min(8, '비밀번호는 8자 이상이어야 해요').max(200, '비밀번호가 너무 깁니다').refine(
    (v) => /[A-Za-z]/.test(v) && /\d/.test(v) || v.length >= 12,
    { message: '비밀번호는 영문+숫자 조합이거나 12자 이상이어야 해요.' },
  ),
}); 

export const profileUpdateRequestSchema = z
  .object({
    displayName: z.string().trim().min(1, '이름을 입력해주세요').max(80, '이름은 80자 이하로 입력해주세요').optional(),
    handle: z
      .string()
      .trim()
      .min(2, '닉네임은 2자 이상이어야 해요')
      .max(32, '닉네임은 32자 이하로 입력해주세요')
      .regex(/^[\p{L}\p{N}_.]+$/u, '닉네임은 한글/영문/숫자/언더스코어/점만 사용 가능합니다.')
      .optional(),
    bio: z.string().trim().max(160, '소개는 160자 이하로 입력해주세요').optional(),
    avatarDataUrl: z.string().max(12_000_000).optional(),
    avatarFileName: z.string().trim().max(140).optional(),
  })
  .refine((value) => value.displayName !== undefined || value.handle !== undefined || value.bio !== undefined || value.avatarDataUrl !== undefined, {
    message: '수정할 프로필 항목을 하나 이상 입력해주세요.',
  });

export const authLoginRequestSchema = z.object({
  email: z.string().trim().email('이메일 형식이 올바르지 않아요').max(180, '이메일이 너무 깁니다'),
  password: z.string().min(1, '비밀번호를 입력해주세요').max(200),
});

export const authHeaderSchema = z
  .string()
  .optional()
  .transform((value) => {
    if (!value?.startsWith('Bearer ')) {
      return null;
    }

    return value.slice('Bearer '.length).trim() || null;
  });

export const pushRegisterSchema = z.object({
  token: z.string().trim().min(1).max(500),
  platform: z.enum(['ios', 'android', 'web']),
});

export const pushRevokeSchema = z.object({
  token: z.string().trim().min(1).max(500),
});

export const recallParamsSchema = z.object({
  id: z.string().min(1),
});

export const appleAuthSchema = z.object({
  identityToken: z.string().min(1).max(4096),
  fullName: z
    .object({
      givenName: z.string().max(80).nullable().optional(),
      familyName: z.string().max(80).nullable().optional(),
    })
    .nullable()
    .optional(),
});

export type PlaceCreateRequest = z.infer<typeof placeCreateSchema>;
export type FeedModeInput = z.infer<typeof feedModeSchema>;
export type PostActionRequest = z.infer<typeof postActionRequestSchema>;
export type CheckInRequest = z.infer<typeof checkInRequestSchema>;
export type MemoryCreateRequest = z.infer<typeof memoryCreateRequestSchema>;
export type MemoryUpdateRequest = z.infer<typeof memoryUpdateRequestSchema>;
export type AuthRegisterRequest = z.infer<typeof authRegisterRequestSchema>;
export type AuthLoginRequest = z.infer<typeof authLoginRequestSchema>;
export type ProfileUpdateRequest = z.infer<typeof profileUpdateRequestSchema>;
