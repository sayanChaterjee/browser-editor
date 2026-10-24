import mongoose, { Schema, Document } from 'mongoose';

export interface ISubmission extends Document {
  userId: string;
  projectId: string;
  html: string;
  css: string;
  js: string;
  timeLeft: number;
  timeTaken: number;
  warningCount: number;
  // Set while the user is banned (user.banned.v1), cleared on unban
  disqualified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubmissionSchema: Schema = new Schema({
  userId: { type: String, required: true },
  projectId: { type: String, required: true },
  html: { type: String, default: '' },
  css: { type: String, default: '' },
  js: { type: String, default: '' },
  timeLeft: { type: Number, default: 0 },
  timeTaken: { type: Number, default: 0 },
  warningCount: { type: Number, default: 0 },
  disqualified: { type: Boolean, default: false },
}, { timestamps: true });

SubmissionSchema.index({ userId: 1 });
SubmissionSchema.index({ projectId: 1 });

export default mongoose.model<ISubmission>('Submission', SubmissionSchema);
