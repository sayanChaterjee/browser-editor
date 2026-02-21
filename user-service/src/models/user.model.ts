import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document<string> {
  _id: string; // Use string for syncing with Auth service
  name: string;
  email?: string;
  warningCount: number;
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: false, unique: true, sparse: true },
  warningCount: { type: Number, default: 0 },
}, {
  timestamps: true,
  collection: 'user', // Use better-auth collection name (singular)
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

UserSchema.virtual('id').get(function () {
  return this._id;
});

export default mongoose.model<IUser>('User', UserSchema);

