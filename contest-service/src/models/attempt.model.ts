import mongoose, { Schema } from 'mongoose';

// A user's contest attempt on one project: anti-cheat strikes so far. Submissions copy the
// count, so submitting never has to ask another service.
export interface IAttempt {
  userId: string;
  projectId: string;
  strikeCount: number;
}

const AttemptSchema = new Schema<IAttempt>({
  userId: { type: String, required: true },
  projectId: { type: String, required: true },
  strikeCount: { type: Number, default: 0 },
}, { timestamps: true });

AttemptSchema.index({ userId: 1, projectId: 1 }, { unique: true });

export default mongoose.model<IAttempt>('Attempt', AttemptSchema);
