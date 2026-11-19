import mongoose, { Document, Schema } from 'mongoose';

export interface IGameRound extends Document {
  roundReference: string;
  gameCode: string;
  mode: 'demo';
  outcome: Record<string, unknown>;
  state?: Record<string, unknown>;
  algorithmVersion: string;
  fairness?: Record<string, unknown>;
  createdAt: Date;
}

const GameRoundSchema = new Schema<IGameRound>({
  roundReference: { type: String, required: true, unique: true, immutable: true },
  gameCode: { type: String, required: true, immutable: true, index: true },
  mode: { type: String, enum: ['demo'], required: true, immutable: true },
  outcome: { type: Schema.Types.Mixed, required: true },
  state: { type: Schema.Types.Mixed },
  algorithmVersion: { type: String, required: true, immutable: true },
  fairness: { type: Schema.Types.Mixed, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: true });

GameRoundSchema.index({ gameCode: 1, createdAt: -1 });

export default mongoose.model<IGameRound>('GameRound', GameRoundSchema);
