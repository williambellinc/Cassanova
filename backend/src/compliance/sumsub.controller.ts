import { Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware';
import User from '../models/User';
import ComplianceDecision from '../models/ComplianceDecision';
import { createSumsubApplicant, createSumsubAccessToken, requestSumsubAmlRecheck } from './sumsub.client';

export const createKycSession = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.status(401).json({ message: 'Authentication required' });
  try {
    const user = await User.findById(req.userId).select('email firstName lastName dateOfBirth sumsubApplicantId').select('+sumsubApplicantId');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.firstName || !user.lastName || !user.dateOfBirth) return res.status(400).json({ message: 'Complete legal name and date of birth before starting identity verification' });
    if (!user.sumsubApplicantId) {
      const created = await createSumsubApplicant({ userId: String(user._id), email: user.email, firstName: user.firstName, lastName: user.lastName, dateOfBirth: user.dateOfBirth });
      user.sumsubApplicantId = created.applicantId;
      user.kycStatus = 'pending';
      await user.save();
      return res.status(201).json({ accessToken: created.accessToken, levelName: created.levelName, status: user.kycStatus });
    }
    const access = await createSumsubAccessToken(String(user._id));
    return res.json({ ...access, status: user.kycStatus });
  } catch (error) {
    console.error('Sumsub KYC session error:', error);
    return res.status(502).json({ message: 'Unable to create identity verification session' });
  }
};

export const requestAmlRecheck = async (req: AuthRequest, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ message: 'Invalid user ID' });
  const user = await User.findById(req.params.userId).select('+sumsubApplicantId');
  if (!user || user.kycStatus !== 'verified' || !user.sumsubApplicantId) return res.status(409).json({ message: 'AML recheck requires an approved Sumsub KYC applicant' });
  try {
    await requestSumsubAmlRecheck(user.sumsubApplicantId);
    user.amlStatus = 'review';
    await user.save();
    return res.status(202).json({ message: 'Sumsub AML recheck requested; account remains blocked pending compliance disposition.' });
  } catch (error) {
    console.error('Sumsub AML recheck failed:', error);
    return res.status(502).json({ message: 'Unable to request AML recheck' });
  }
};

export const receiveSumsubWebhook = async (req: any, res: Response) => {
  const secret = process.env.SUMSUB_WEBHOOK_SECRET;
  if (!secret || !Buffer.isBuffer(req.body)) return res.status(503).json({ message: 'Sumsub webhook is not configured' });
  const algHeader = String(req.header('x-payload-digest-alg') || 'HMAC_SHA256_HEX');
  const algorithms: Record<string, string> = { HMAC_SHA1_HEX: 'sha1', HMAC_SHA256_HEX: 'sha256', HMAC_SHA512_HEX: 'sha512' };
  const algorithm = algorithms[algHeader];
  const supplied = String(req.header('x-payload-digest') || '');
  if (!algorithm || !/^[a-f0-9]+$/i.test(supplied)) return res.status(401).json({ message: 'Unsupported Sumsub webhook signature' });
  const expected = createHmac(algorithm, secret).update(req.body).digest('hex');
  const a = Buffer.from(supplied, 'hex'), b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return res.status(401).json({ message: 'Invalid Sumsub webhook signature' });
  try {
    const event = JSON.parse(req.body.toString('utf8')) as any;
    if (event?.type !== 'applicantReviewed' || !mongoose.isValidObjectId(event?.externalUserId)) return res.status(200).json({ received: true, ignored: true });
    const answer = event?.reviewResult?.reviewAnswer;
    const reviewAt = event?.createdAtMs ? new Date(event.createdAtMs) : new Date();
    if (!Number.isFinite(reviewAt.getTime())) return res.status(400).json({ message: 'Invalid review timestamp' });
    const update: any = answer === 'GREEN' ? { kycStatus: 'verified', sumsubApplicantId: String(event.applicantId), sumsubLastReviewAt: reviewAt }
      : answer === 'RED' ? { kycStatus: 'rejected', sumsubApplicantId: String(event.applicantId), sumsubLastReviewAt: reviewAt }
      : { kycStatus: 'pending', sumsubApplicantId: String(event.applicantId), sumsubLastReviewAt: reviewAt };
    const user = await User.findOneAndUpdate({
      _id: event.externalUserId,
      $or: [{ sumsubLastReviewAt: { $exists: false } }, { sumsubLastReviewAt: null }, { sumsubLastReviewAt: { $lte: reviewAt } }],
    }, { $set: update }, { new: true });
    if (!user) return res.status(200).json({ received: true, staleOrUnknown: true });
    // AML is intentionally not auto-cleared by a KYC GREEN result. A configured
    // AML check and a human compliance disposition must set amlStatus='clear'.
    return res.status(200).json({ received: true, updated: true, kycStatus: user.kycStatus });
  } catch (error) {
    console.error('Sumsub webhook processing failed:', error);
    return res.status(500).json({ message: 'Unable to process Sumsub webhook' });
  }
};

export const setAmlDisposition = async (req: AuthRequest, res: Response) => {
  if (!req.userId || !mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ message: 'Valid user ID is required' });
  const status = String(req.body?.status || '');
  const reason = String(req.body?.reason || '').trim();
  const evidenceReference = req.body?.evidenceReference ? String(req.body.evidenceReference).slice(0, 256) : undefined;
  if (!['clear','review','blocked'].includes(status) || reason.length < 10 || reason.length > 2000) {
    return res.status(400).json({ message: 'status must be clear, review or blocked, and a 10–2000 character reason is required' });
  }
  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (status === 'clear' && user.kycStatus !== 'verified') return res.status(409).json({ message: 'AML cannot be cleared before KYC is verified' });
  if (status === 'clear' && !evidenceReference) return res.status(400).json({ message: 'An evidence reference is required to clear an AML review' });
  const previousStatus = user.amlStatus;
  await ComplianceDecision.create({ userId: user._id, actorId: req.userId, previousStatus, newStatus: status, reason, evidenceReference });
  user.amlStatus = status as any;
  await user.save();
  return res.json({ userId: user._id, previousStatus, amlStatus: user.amlStatus, auditRecorded: true });
};
