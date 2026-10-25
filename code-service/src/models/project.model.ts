import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
  userId: string;
  name: string;
  html: string;
  css: string;
  js: string;
  timeLeft: number;
  warningCount: number;
  // When html/css/js last changed in MongoDB. Unlike updatedAt (which any write touches,
  // e.g. a strike count), it only moves with content, so it orders content versions.
  contentUpdatedAt?: Date;
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
  contentUpdatedAt: { type: Date },
}, { timestamps: true });

// Allow multiple projects per user, but unique name per user
ProjectSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.model<IProject>('Project', ProjectSchema);
