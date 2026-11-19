import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  previousStatus: { type: String, required: true, immutable: true },
  newStatus: { type: String, enum: ['clear','review','blocked'], required: true, immutable: true },
  reason: { type: String, required: true, minlength: 10, maxlength: 2000, immutable: true },
  evidenceReference: { type: String, maxlength: 256, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });
schema.index({ userId: 1, createdAt: -1 });
export default mongoose.model('ComplianceDecision', schema);
