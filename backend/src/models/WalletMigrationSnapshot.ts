import mongoose, { Document, Schema } from 'mongoose';

export interface IWalletMigrationSnapshot extends Document {
  batchKey: string;
  userId: mongoose.Types.ObjectId;
  currency: string;
  legacyBalanceMinor: number;
  legacyBonusMinor: number;
  journalReference: string;
  migratedAt: Date;
}

const WalletMigrationSnapshotSchema = new Schema<IWalletMigrationSnapshot>({
  batchKey: { type: String, required: true, immutable: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  currency: { type: String, required: true, uppercase: true, immutable: true },
  legacyBalanceMinor: { type: Number, required: true, min: 0, immutable: true },
  legacyBonusMinor: { type: Number, required: true, min: 0, immutable: true },
  journalReference: { type: String, required: true, immutable: true },
  migratedAt: { type: Date, default: Date.now, immutable: true },
}, { versionKey: false });

WalletMigrationSnapshotSchema.index({ batchKey: 1, userId: 1 }, { unique: true });

export default mongoose.model<IWalletMigrationSnapshot>('WalletMigrationSnapshot', WalletMigrationSnapshotSchema);
