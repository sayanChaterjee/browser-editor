import { z } from 'zod';
import { envelope } from './envelope';

// Published by identity-service on TOPICS.userEvents, keyed by userId.
// Payloads carry what consumers need and no more: no email or other personal data.

export const UserRegisteredV1 = envelope(
  'user.registered.v1',
  z.object({
    userId: z.string().min(1),
    name: z.string(),
    registeredAt: z.string().datetime(),
  }),
);

export const UserBannedV1 = envelope(
  'user.banned.v1',
  z.object({
    userId: z.string().min(1),
    // Admin who banned the user
    bannedBy: z.string().min(1),
    bannedAt: z.string().datetime(),
  }),
);

export const UserUnbannedV1 = envelope(
  'user.unbanned.v1',
  z.object({
    userId: z.string().min(1),
    unbannedBy: z.string().min(1),
    unbannedAt: z.string().datetime(),
  }),
);

export const UserEvent = z.discriminatedUnion('type', [UserRegisteredV1, UserBannedV1, UserUnbannedV1]);

export type UserRegisteredV1 = z.infer<typeof UserRegisteredV1>;
export type UserBannedV1 = z.infer<typeof UserBannedV1>;
export type UserUnbannedV1 = z.infer<typeof UserUnbannedV1>;
export type UserEvent = z.infer<typeof UserEvent>;
