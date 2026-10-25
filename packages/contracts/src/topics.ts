// Kafka topics. Production (Aiven) caps the number of topics, so there is one topic per
// publishing service, keyed by userId to keep each user's events in order, and every
// consumer shares one dead-letter topic.
export const TOPICS = {
  userEvents: 'identity.user-events',
  contestEvents: 'contest.events',
  deadLetter: 'dead-letter',
} as const;

