import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document<string> {
  _id: string; // Use string for syncing with Auth service
  name: string;
  email: string;
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  _id: { type: String, required: true }, // Manually set ID from event
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
}, { timestamps: true });

export default mongoose.model<IUser>('User', UserSchema);
