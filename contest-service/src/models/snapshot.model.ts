import mongoose, { Schema } from 'mongoose';

// The contestant's code at a moment of the contest (sent with a heartbeat about once a minute,
// when it changed), for the admin's replay (domain/replay).
export interface ISnapshot {
  userId: string;
  projectId: string;
  at: Date;
  html: string;
  css: string;
  js: string;
  chars: number;
}

const SnapshotSchema = new Schema<ISnapshot>({
  userId: { type: String, required: true },
  projectId: { type: String, required: true },
  at: { type: Date, required: true },
  html: { type: String, default: '' },
  css: { type: String, default: '' },
  js: { type: String, default: '' },
  chars: { type: Number, required: true },
}, { versionKey: false });

SnapshotSchema.index({ userId: 1, projectId: 1, at: 1 });

export default mongoose.model<ISnapshot>('Snapshot', SnapshotSchema);
