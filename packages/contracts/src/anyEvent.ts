import { z } from 'zod';
import { ContestEvent } from './contestEvents';
import { UserEvent } from './userEvents';

/** Any published event: for consumers that read several topics with one handler. */
export const AnyEvent = z.discriminatedUnion('type', [...UserEvent.options, ...ContestEvent.options]);
export type AnyEvent = z.infer<typeof AnyEvent>;
