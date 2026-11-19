import mongoose, { Document, Schema } from 'mongoose';

export interface ILedgerLine {
  accountId: mongoose.Types.ObjectId;
  direction: 'debit' | 'credit';
  amountMinor: number;
}

export interface ILedgerJournal extends Document {
  idempotencyKey: string;
  reference: string;
  currency: string;
  description: string;
  lines: ILedgerLine[];
  state: 'posted' | 'reversed';
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const LedgerLineSchema = new Schema<ILedgerLine>({
  accountId: { type: Schema.Types.ObjectId, ref: 'LedgerAccount', required: true },
  direction: { type: String, enum: ['debit', 'credit'], required: true },
  amountMinor: { type: Number, required: true, min: 1 },
}, { _id: false });

const LedgerJournalSchema = new Schema<ILedgerJournal>({
  idempotencyKey: { type: String, required: true, immutable: true },
  reference: { type: String, required: true, immutable: true },
  currency: { type: String, required: true, immutable: true },
  description: { type: String, required: true, immutable: true },
  lines: { type: [LedgerLineSchema], required: true, immutable: true },
  state: { type: String, enum: ['posted', 'reversed'], default: 'posted', immutable: true },
  metadata: { type: Schema.Types.Mixed, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

LedgerJournalSchema.index({ idempotencyKey: 1 }, { unique: true });
LedgerJournalSchema.index({ reference: 1 });

export default mongoose.model<ILedgerJournal>('LedgerJournal', LedgerJournalSchema);
