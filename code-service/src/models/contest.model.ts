import mongoose, { Schema, Document } from 'mongoose';

export interface IContest extends Document {
    title: string;
    startTime: Date;
    endTime: Date;
    imageUrl?: string;
    html?: string;
    css?: string;
    js?: string;
    status: 'pending' | 'active' | 'ended';
    createdAt: Date;
    updatedAt: Date;
}

const ContestSchema: Schema = new Schema({
    title: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    imageUrl: { type: String, required: false },
    html: { type: String, required: false },
    css: { type: String, required: false },
    js: { type: String, required: false },
    status: { type: String, enum: ['pending', 'active', 'ended'], default: 'pending' },
}, { timestamps: true });

export default mongoose.model<IContest>('Contest', ContestSchema);
