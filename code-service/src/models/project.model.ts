import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
  userId: string;
  name: string;
  html: string;
  css: string;
  js: string;
  timeLeft: number;
  warningCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema: Schema = new Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  html: { type: String, default: '' },
  css: { type: String, default: '' },
  js: { type: String, default: '' },
  timeLeft: { type: Number, default: 180 * 60 },
  warningCount: { type: Number, default: 0 },
}, { timestamps: true });

// Allow multiple projects per user, but unique name per user
ProjectSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.model<IProject>('Project', ProjectSchema);
