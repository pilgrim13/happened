import { z } from 'zod';

export const feedModeSchema = z.enum(['Following', 'Nearby', 'Memories']);
export const visibilitySchema = z.enum(['Followers', 'PublicAfter1h', 'Public']);
export const memoryPostActionSchema = z.enum(['echo', 'save', 'reply', 'hide', 'report']);

export const feedQuerySchema = z.object({
  mode: feedModeSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
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
  password: z.string().min(8).max(200),
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

export const memoryCreateRequestSchema = z.object({
  checkInTokenId: z.string().trim().min(1),
  caption: z.string().trim().min(1).max(500),
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
  message: 'At least one photo (or mediaKey) is required.',
});

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().positive().max(100_000).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const memoryUpdateRequestSchema = z
  .object({
    caption: z.string().trim().min(1).max(500).optional(),
    visibility: visibilitySchema.optional(),
  })
  .refine((value) => value.caption !== undefined || value.visibility !== undefined, {
    message: 'At least one post field is required.',
  });

export const authRegisterRequestSchema = z.object({
  email: z.string().trim().email().max(180),
  displayName: z.string().trim().min(1).max(80),
  handle: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[a-zA-Z0-9_.]+$/),
  // Add a refined password schema for register
  password: z.string().min(8).max(200).refine(
    (v) => /[A-Za-z]/.test(v) && /\d/.test(v) || v.length >= 12,
    { message: 'Password must contain letters and numbers, or be 12+ characters.' },
  ),
}); 

export const profileUpdateRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    handle: z
      .string()
      .trim()
      .min(2)
      .max(32)
      .regex(/^[a-zA-Z0-9_.]+$/)
      .optional(),
    bio: z.string().trim().max(160).optional(),
    avatarDataUrl: z.string().max(12_000_000).optional(),
    avatarFileName: z.string().trim().max(140).optional(),
  })
  .refine((value) => value.displayName !== undefined || value.handle !== undefined || value.bio !== undefined || value.avatarDataUrl !== undefined, {
    message: 'At least one profile field is required.',
  });

export const authLoginRequestSchema = z.object({
  email: z.string().trim().email().max(180),
  password: z.string().min(1).max(200),
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

export type FeedModeInput = z.infer<typeof feedModeSchema>;
export type PostActionRequest = z.infer<typeof postActionRequestSchema>;
export type CheckInRequest = z.infer<typeof checkInRequestSchema>;
export type MemoryCreateRequest = z.infer<typeof memoryCreateRequestSchema>;
export type MemoryUpdateRequest = z.infer<typeof memoryUpdateRequestSchema>;
export type AuthRegisterRequest = z.infer<typeof authRegisterRequestSchema>;
export type AuthLoginRequest = z.infer<typeof authLoginRequestSchema>;
export type ProfileUpdateRequest = z.infer<typeof profileUpdateRequestSchema>;
