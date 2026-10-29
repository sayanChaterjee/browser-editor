import mongoose, { Schema, Document } from 'mongoose';

/** Evidence for a reviewer, gathered at submission; flags name what looks off. */
export interface ISignals {
  heartbeats: number;
  expectedHeartbeats: number;
  gaps: number;
  offlineSeconds: number;
  typedChars: number;
  pastedChars: number;
  pasteCount: number;
  largestPaste: number;
  // Characters in the submission not explained by the starting code plus what was typed or
  // pasted in the editor: code that arrived some other way
  unexplainedChars: number;
  // Closest other submission in the same contest
  similarity: { score: number; submissionId: string; userId: string } | null;
  // Similarity to the contest's target code (which the browser receives to show the target)
  targetSimilarity: number;
}

export const FLAGS = [
  'missing-heartbeats',
  'offline',
  'large-paste',
  'code-without-typing',
  'similar-submission',
  'matches-target',
] as const;
export type Flag = (typeof FLAGS)[number];

export interface ISubmission extends Document {
  userId: string;
  projectId: string;
  // Contest that was active when it was submitted, if any
  contestId: string | null;
  html: string;
  css: string;
  js: string;
  timeLeft: number;
  timeTaken: number;
  warningCount: number;
  // Set while the user is banned (user.banned.v1), cleared on unban
  disqualified: boolean;
  signals: ISignals | null;
  flags: Flag[];
  // MinHash sketch of the code (domain/similarity), for comparing later submissions
  fingerprint: number[];
  createdAt: Date;
  updatedAt: Date;
}

const SubmissionSchema: Schema = new Schema({
  userId: { type: String, required: true },
  projectId: { type: String, required: true },
  contestId: { type: String, default: null },
  html: { type: String, default: '' },
  css: { type: String, default: '' },
  js: { type: String, default: '' },
  timeLeft: { type: Number, default: 0 },
  timeTaken: { type: Number, default: 0 },
  warningCount: { type: Number, default: 0 },
  disqualified: { type: Boolean, default: false },
  signals: { type: Schema.Types.Mixed, default: null },
  flags: { type: [String], enum: FLAGS, default: [] },
  fingerprint: { type: [Number], default: [], select: false },
}, { timestamps: true });

SubmissionSchema.index({ userId: 1 });
SubmissionSchema.index({ projectId: 1 });
SubmissionSchema.index({ contestId: 1 });

export default mongoose.model<ISubmission>('Submission', SubmissionSchema);
