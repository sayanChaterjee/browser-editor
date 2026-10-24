// Kafka topics. Production (Aiven) caps the number of topics, so streams are per
// aggregate (all user events on one topic, keyed by userId to keep each user's events
// in order) and every consumer shares one dead-letter topic.
export const TOPICS = {
  userEvents: 'identity.user-events',
  deadLetter: 'dead-letter',
} as const;

