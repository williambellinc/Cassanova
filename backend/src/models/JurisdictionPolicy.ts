import mongoose, { Document, Schema } from 'mongoose';

export interface IJurisdictionPolicy extends Document {
  jurisdictionCode: string;
  operatorEntity: string;
  licenceReference?: string;
  status: 'disabled' | 'review' | 'enabled' | 'suspended';
  permittedProducts: string[];
  evidenceReviewedAt?: Date;
  reviewedBy?: string;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
}

const JurisdictionPolicySchema = new Schema<IJurisdictionPolicy>({
  jurisdictionCode: { type: String, required: true, uppercase: true },
  operatorEntity: { type: String, required: true },
  licenceReference: { type: String },
  status: { type: String, enum: ['disabled', 'review', 'enabled', 'suspended'], default: 'disabled', required: true },
  permittedProducts: [{ type: String }],
  evidenceReviewedAt: { type: Date },
  reviewedBy: { type: String },
  effectiveFrom: { type: Date },
  effectiveUntil: { type: Date },
}, { timestamps: true });

JurisdictionPolicySchema.index({ jurisdictionCode: 1, operatorEntity: 1 }, { unique: true });

export default mongoose.model<IJurisdictionPolicy>('JurisdictionPolicy', JurisdictionPolicySchema);
