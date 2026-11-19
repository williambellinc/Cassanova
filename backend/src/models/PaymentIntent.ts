import mongoose, { Document, Schema } from 'mongoose';

export interface IPaymentIntent extends Document {
  userId: mongoose.Types.ObjectId;
  provider: string;
  merchantReference: string;
  providerPaymentId?: string;
  amountMinor: number;
  currency: string;
  status: 'pending' | 'settled' | 'failed' | 'refunded' | 'review';
  createdAt: Date;
  updatedAt: Date;
}

const PaymentIntentSchema = new Schema<IPaymentIntent>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  provider: { type: String, required: true, immutable: true },
  merchantReference: { type: String, required: true, unique: true, immutable: true },
  providerPaymentId: { type: String },
  amountMinor: { type: Number, required: true, min: 1, immutable: true },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3, immutable: true },
  status: { type: String, enum: ['pending', 'settled', 'failed', 'refunded', 'review'], default: 'pending', required: true },
}, { timestamps: true, versionKey: false });

PaymentIntentSchema.index({ provider: 1, providerPaymentId: 1 }, { sparse: true, unique: true });

export default mongoose.model<IPaymentIntent>('PaymentIntent', PaymentIntentSchema);
