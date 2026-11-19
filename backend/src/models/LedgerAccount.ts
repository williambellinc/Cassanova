import mongoose, { Document, Schema } from 'mongoose';

export type LedgerAccountType = 'player_wallet' | 'payment_clearing' | 'operator_revenue' | 'bonus_liability' | 'migration_clearing' | 'opening_balance_equity';

export interface ILedgerAccount extends Document {
  ownerType: 'user' | 'system';
  ownerId: string;
  accountType: LedgerAccountType;
  currency: string;
  balanceMinor: number;
  status: 'open' | 'frozen' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

const LedgerAccountSchema = new Schema<ILedgerAccount>({
  ownerType: { type: String, enum: ['user', 'system'], required: true },
  ownerId: { type: String, required: true },
  accountType: { type: String, enum: ['player_wallet', 'payment_clearing', 'operator_revenue', 'bonus_liability', 'migration_clearing', 'opening_balance_equity'], required: true },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
  balanceMinor: { type: Number, required: true, default: 0, min: 0 },
  status: { type: String, enum: ['open', 'frozen', 'closed'], default: 'open', required: true },
}, { timestamps: true, versionKey: false });

LedgerAccountSchema.index({ ownerType: 1, ownerId: 1, accountType: 1, currency: 1 }, { unique: true });

export default mongoose.model<ILedgerAccount>('LedgerAccount', LedgerAccountSchema);
