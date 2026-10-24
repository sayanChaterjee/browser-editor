import mongoose, { Schema } from 'mongoose';

// Events this service has already handled, so Kafka redeliveries are skipped. Kept for
// 7 days: far longer than any redelivery window.
const ProcessedEventSchema = new Schema({
  _id: { type: String, required: true }, // eventId
  type: { type: String, required: true },
  processedAt: { type: Date, default: Date.now, expires: 7 * 24 * 3600 },
}, { versionKey: false });

export default mongoose.model('ProcessedEvent', ProcessedEventSchema);
