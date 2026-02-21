import mongoose, { Schema, Document } from 'mongoose';

export interface ISubmission extends Document {
  userId: string;
  projectId: string;
  html: string;
  css: string;
  js: string;
  timeLeft: number;
  warningCount: number;
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
  warningCount: { type: Number, default: 0 },
}, { timestamps: true });

SubmissionSchema.index({ userId: 1 });
SubmissionSchema.index({ projectId: 1 });

export default mongoose.model<ISubmission>('Submission', SubmissionSchema);
