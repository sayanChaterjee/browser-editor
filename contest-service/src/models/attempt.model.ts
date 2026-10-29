import mongoose, { Schema } from 'mongoose';

/**
 * What the editor reported while the contest ran, from its heartbeats (POST
 * /contest/activity/:projectId every HEARTBEAT_SECONDS). Characters typed vs inserted in bulk
 * (pasted, dropped or scripted), and gaps where no heartbeat arrived.
 */
export interface IActivity {
  heartbeats: number;
  lastHeartbeatAt: Date | null;
  gaps: number;
  offlineSeconds: number;
  // Size of the code when the contest started (first heartbeat)
  startChars: number | null;
  typedChars: number;
  pastedChars: number;
  pasteCount: number;
  largestPaste: number;
}

// A user's contest attempt on one project: anti-cheat strikes and activity so far.
// Submissions copy them, so submitting never has to ask another service.
export interface IAttempt {
  userId: string;
  projectId: string;
  strikeCount: number;
  activity?: IActivity;
}

const ActivitySchema = new Schema<IActivity>({
  heartbeats: { type: Number, default: 0 },
  lastHeartbeatAt: { type: Date, default: null },
  gaps: { type: Number, default: 0 },
  offlineSeconds: { type: Number, default: 0 },
  startChars: { type: Number, default: null },
  typedChars: { type: Number, default: 0 },
  pastedChars: { type: Number, default: 0 },
  pasteCount: { type: Number, default: 0 },
  largestPaste: { type: Number, default: 0 },
}, { _id: false });

const AttemptSchema = new Schema<IAttempt>({
  userId: { type: String, required: true },
  projectId: { type: String, required: true },
  strikeCount: { type: Number, default: 0 },
  activity: { type: ActivitySchema, default: undefined },
}, { timestamps: true });

AttemptSchema.index({ userId: 1, projectId: 1 }, { unique: true });

export default mongoose.model<IAttempt>('Attempt', AttemptSchema);
