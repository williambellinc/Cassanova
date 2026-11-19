import mongoose, { Document, Schema } from 'mongoose';

export interface IWithdrawalRequest extends Document {
  userId: mongoose.Types.ObjectId;
  beneficiaryId: mongoose.Types.ObjectId;
  provider: string;
  currency: string;
  jurisdictionCode: string;
  amountMinor: number;
  feeMinor: number;
  status: 'reserved' | 'approved' | 'submitted' | 'review' | 'paid' | 'failed' | 'rejected';
  merchantReference: string;
  providerPayoutId?: string;
  reservedJournalId: string;
  approvedBy?: mongoose.Types.ObjectId;
  submittedAt?: Date;
  settledAt?: Date;
  failureReason?: string;
}
const schema = new Schema<IWithdrawalRequest>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  beneficiaryId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  provider: { type: String, required: true, immutable: true },
  currency: { type: String, required: true, uppercase: true, immutable: true },
  jurisdictionCode: { type: String, required: true, uppercase: true, immutable: true },
  amountMinor: { type: Number, required: true, min: 1, immutable: true },
  feeMinor: { type: Number, required: true, min: 0, default: 0, immutable: true },
  status: { type: String, enum: ['reserved','approved','submitted','review','paid','failed','rejected'], default: 'reserved', required: true },
  merchantReference: { type: String, required: true, unique: true, immutable: true },
  providerPayoutId: { type: String },
  reservedJournalId: { type: String, required: true, immutable: true },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  submittedAt: Date, settledAt: Date, failureReason: String,
}, { timestamps: true, versionKey: false });
schema.index({ userId: 1, createdAt: -1 });
schema.index({ provider: 1, providerPayoutId: 1 }, { sparse: true, unique: true });
export default mongoose.model<IWithdrawalRequest>('WithdrawalRequest', schema);
