import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  provider: { type: String, required: true, immutable: true },
  providerReference: { type: String, required: true, select: false, immutable: true },
  currency: { type: String, required: true, uppercase: true, immutable: true },
  verifiedAt: { type: Date, required: true, immutable: true },
  verificationMethod: { type: String, required: true, immutable: true },
  status: { type: String, enum: ['verified','suspended'], default: 'verified', required: true },
}, { timestamps: true, versionKey: false });
schema.index({ userId: 1, provider: 1, currency: 1 });
export default mongoose.model('PayoutBeneficiary', schema);
