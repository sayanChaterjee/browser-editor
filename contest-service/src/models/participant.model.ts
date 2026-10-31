import mongoose, { Schema } from 'mongoose';

// A user in a contest: joined the room (before or during it), the project they work in, and
// when they submitted. One per user and contest.
export interface IParticipant {
  contestId: string;
  userId: string;
  joinedAt: Date;
  projectId: string | null;
  submittedAt: Date | null;
}

const ParticipantSchema = new Schema<IParticipant>({
  contestId: { type: String, required: true },
  userId: { type: String, required: true },
  joinedAt: { type: Date, required: true },
  projectId: { type: String, default: null },
  submittedAt: { type: Date, default: null },
}, { versionKey: false });

ParticipantSchema.index({ contestId: 1, userId: 1 }, { unique: true });
ParticipantSchema.index({ userId: 1 });

export default mongoose.model<IParticipant>('Participant', ParticipantSchema);
