import mongoose, { Document, Schema } from 'mongoose';

export interface IPaymentEvent extends Document {
  provider: string;
  providerEventId: string;
  providerPaymentId: string;
  merchantReference: string;
  amountMinor: number;
  currency: string;
  eventStatus: string;
  payloadHash: string;
  verificationStatus: 'unverified' | 'verified' | 'rejected';
  processingStatus: 'received' | 'processed' | 'ignored' | 'failed';
  receivedAt: Date;
}

const PaymentEventSchema = new Schema<IPaymentEvent>({
  provider: { type: String, required: true },
  providerEventId: { type: String, required: true },
  providerPaymentId: { type: String, required: true },
  merchantReference: { type: String, required: true },
  amountMinor: { type: Number, required: true, min: 1 },
  currency: { type: String, required: true, uppercase: true },
  eventStatus: { type: String, required: true },
  payloadHash: { type: String, required: true },
  verificationStatus: { type: String, enum: ['unverified', 'verified', 'rejected'], default: 'unverified' },
  processingStatus: { type: String, enum: ['received', 'processed', 'ignored', 'failed'], default: 'received' },
}, { timestamps: { createdAt: 'receivedAt', updatedAt: false }, versionKey: false });

PaymentEventSchema.index({ provider: 1, providerEventId: 1 }, { unique: true });
PaymentEventSchema.index({ merchantReference: 1 });

export default mongoose.model<IPaymentEvent>('PaymentEvent', PaymentEventSchema);
