import { Response } from 'express';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware';
import User from '../models/User';
import PayoutBeneficiary from '../models/PayoutBeneficiary';
import WithdrawalRequest from '../models/WithdrawalRequest';
import JurisdictionPolicy from '../models/JurisdictionPolicy';
import { paymentProviders } from '../payments/payment-provider.contract';
import { getOrCreateLedgerAccount, postLedgerEntry } from '../services/ledger.service';

export const requestWithdrawal = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.status(401).json({ message: 'Authentication required' });
  const amountMinor = Number(req.body?.amountMinor);
  const currency = String(req.body?.currency || '').toUpperCase();
  const beneficiaryId = String(req.body?.beneficiaryId || '');
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !/^[A-Z]{3}$/.test(currency) || !mongoose.isValidObjectId(beneficiaryId)) {
    return res.status(400).json({ message: 'Valid amountMinor, currency and verified beneficiaryId are required' });
  }
  const user = await User.findById(req.userId).select('kycStatus dateOfBirth responsibleGaming').lean();
  if (!user || user.kycStatus !== 'verified') return res.status(403).json({ message: 'Completed KYC verification is required' });
  if (!user.dateOfBirth || new Date(user.dateOfBirth).getTime() > Date.now() - 18 * 365.25 * 86400000) {
    return res.status(403).json({ message: 'Age verification failed' });
  }
  if (user.responsibleGaming?.selfExclusionUntil && new Date(user.responsibleGaming.selfExclusionUntil) > new Date()) {
    return res.status(403).json({ message: 'Account is self-excluded' });
  }
  if (!req.jurisdictionCode) return res.status(403).json({ message: 'Trusted jurisdiction verification is required' });
  const pending = await WithdrawalRequest.findOne({ userId: req.userId, status: { $in: ['reserved','approved','submitted'] } }).lean();
  if (pending) return res.status(409).json({ message: 'An existing withdrawal is still being processed' });
  const beneficiary = await PayoutBeneficiary.findOne({ _id: beneficiaryId, userId: req.userId, currency, status: 'verified' }).select('+providerReference').lean();
  if (!beneficiary) return res.status(403).json({ message: 'A verified beneficiary matching the withdrawal currency is required' });
  const provider = paymentProviders.get(beneficiary.provider);
  if (!provider) return res.status(503).json({ message: 'Beneficiary payment provider is not configured' });

  const wallet = await getOrCreateLedgerAccount({ ownerType: 'user', ownerId: req.userId, accountType: 'player_wallet', currency });
  const liability = await getOrCreateLedgerAccount({ ownerType: 'system', ownerId: 'velt-withdrawals', accountType: 'withdrawal_liability', currency });
  const merchantReference = 'velt_wd_' + randomUUID().replace(/-/g, '');
  try {
    const journal = await postLedgerEntry({
      lines: [
        { accountId: String(wallet._id), direction: 'debit', amountMinor },
        { accountId: String(liability._id), direction: 'credit', amountMinor },
      ],
      currency, idempotencyKey: 'withdrawal-reserve:' + merchantReference, reference: merchantReference,
      description: 'Player withdrawal funds reserved',
      metadata: { userId: req.userId, beneficiaryId, provider: beneficiary.provider },
    });
    const withdrawal = await WithdrawalRequest.create({
      userId: req.userId, beneficiaryId, provider: beneficiary.provider, currency, amountMinor,
      feeMinor: 0, status: 'reserved', merchantReference, reservedJournalId: String(journal._id), jurisdictionCode: req.jurisdictionCode,
    });
    return res.status(201).json({ withdrawalId: withdrawal._id, merchantReference, amountMinor, currency, status: withdrawal.status, message: 'Funds reserved; withdrawal awaits independent compliance approval.' });
  } catch (error: any) {
    if (error?.code === 'INSUFFICIENT_FUNDS' || error?.code === 'ACCOUNT_UPDATE_CONFLICT') return res.status(409).json({ message: 'Insufficient available wallet funds' });
    console.error('Withdrawal reservation failed:', error);
    return res.status(500).json({ message: 'Unable to reserve withdrawal funds' });
  }
};

export const approveAndSubmitWithdrawal = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.status(401).json({ message: 'Authentication required' });
  if (!mongoose.isValidObjectId(req.params.withdrawalId)) return res.status(400).json({ message: 'Invalid withdrawal ID' });
  const withdrawal = await WithdrawalRequest.findById(req.params.withdrawalId);
  if (!withdrawal) return res.status(404).json({ message: 'Withdrawal not found' });
  if (String(withdrawal.userId) === req.userId) return res.status(403).json({ message: 'Maker-checker control: requester cannot approve their own withdrawal' });
  if (withdrawal.status !== 'reserved' && withdrawal.status !== 'approved') return res.status(409).json({ message: 'Withdrawal is not awaiting approval or submission' });
  const player = await User.findById(withdrawal.userId).select('kycStatus amlStatus dateOfBirth responsibleGaming').lean();
  if (!player || player.kycStatus !== 'verified' || player.amlStatus !== 'clear' || !player.dateOfBirth || new Date(player.dateOfBirth).getTime() > Date.now() - 18 * 365.25 * 86400000 || (player.responsibleGaming?.selfExclusionUntil && new Date(player.responsibleGaming.selfExclusionUntil) > new Date())) return res.status(403).json({ message: 'Player compliance eligibility changed; withdrawal held for review' });
  const policy = await JurisdictionPolicy.findOne({ jurisdictionCode: withdrawal.jurisdictionCode, operatorEntity: process.env.VELT_OPERATOR_ENTITY, status: 'enabled', permittedProducts: 'casino', licenceReference: { $exists: true, $ne: '' }, evidenceReviewedAt: { $exists: true }, effectiveFrom: { $lte: new Date() }, $or: [{ effectiveUntil: { $exists: false } }, { effectiveUntil: null }, { effectiveUntil: { $gt: new Date() } }] }).lean();
  if (!policy) return res.status(403).json({ message: 'Operator jurisdiction authorisation is no longer active' });
  const beneficiary = await PayoutBeneficiary.findOne({ _id: withdrawal.beneficiaryId, userId: withdrawal.userId, status: 'verified' }).select('+providerReference').lean();
  if (!beneficiary) return res.status(409).json({ message: 'Verified beneficiary is no longer available' });
  const provider = paymentProviders.get(withdrawal.provider);
  if (!provider) return res.status(503).json({ message: 'Payout provider is not configured' });
  withdrawal.status = 'approved';
  withdrawal.approvedBy = new mongoose.Types.ObjectId(req.userId);
  await withdrawal.save();
  try {
    const payout = await provider.requestPayout({
      merchantReference: withdrawal.merchantReference, amountMinor: withdrawal.amountMinor,
      currency: withdrawal.currency, beneficiaryReference: beneficiary.providerReference,
    });
    withdrawal.providerPayoutId = payout.providerPayoutId;
    withdrawal.status = 'submitted';
    withdrawal.submittedAt = new Date();
    await withdrawal.save();
    return res.json({ withdrawalId: withdrawal._id, status: withdrawal.status, providerPayoutId: withdrawal.providerPayoutId, message: 'Provider accepted the payout instruction; funds remain reserved until independently verified settlement.' });
  } catch (error) {
    console.error('Payout submission failed:', error);
    return res.status(502).json({ withdrawalId: withdrawal._id, status: withdrawal.status, message: 'Provider submission failed. Funds remain reserved for controlled retry or reversal.' });
  }
};
