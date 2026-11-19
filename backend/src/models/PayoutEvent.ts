import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  provider: { type: String, required: true }, providerEventId: { type: String, required: true },
  merchantReference: { type: String, required: true }, providerPayoutId: { type: String, required: true },
  amountMinor: { type: Number, required: true, min: 1 }, currency: { type: String, required: true, uppercase: true },
  status: { type: String, enum: ['paid','failed'], required: true }, payloadHash: { type: String, required: true },
  processedAt: { type: Date, default: Date.now },
}, { versionKey: false });
schema.index({ provider: 1, providerEventId: 1 }, { unique: true });
export default mongoose.model('PayoutEvent', schema);
