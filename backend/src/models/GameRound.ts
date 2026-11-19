import mongoose, { Document, Schema } from 'mongoose';

export interface IGameRound extends Document {
  roundReference: string;
  gameCode: string;
  mode: 'demo';
  outcome: { diceValue: number; result: 'even' | 'odd' };
  algorithmVersion: string;
  createdAt: Date;
}

const GameRoundSchema = new Schema<IGameRound>({
  roundReference: { type: String, required: true, unique: true, immutable: true },
  gameCode: { type: String, required: true, immutable: true },
  mode: { type: String, enum: ['demo'], required: true, immutable: true },
  outcome: {
    diceValue: { type: Number, required: true, min: 1, max: 6 },
    result: { type: String, enum: ['even', 'odd'], required: true },
  },
  algorithmVersion: { type: String, required: true, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

export default mongoose.model<IGameRound>('GameRound', GameRoundSchema);
