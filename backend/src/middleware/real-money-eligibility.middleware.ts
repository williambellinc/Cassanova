import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import User from '../models/User';
import JurisdictionPolicy from '../models/JurisdictionPolicy';

/**
 * Requires a separately contracted trusted geolocation service that returns:
 * { countryCode, isReliable, isVpn, isProxy, isTor, isHosting }.
 * Never trusts client-supplied country headers or profile address.
 */
export const requireCasinoEligibility = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) return res.status(401).json({ message: 'Authentication required' });
    const geoUrl = process.env.TRUSTED_GEOLOCATION_URL;
    const geoToken = process.env.TRUSTED_GEOLOCATION_TOKEN;
    const operatorEntity = process.env.VELT_OPERATOR_ENTITY;
    if (!geoUrl || !geoToken || !operatorEntity) {
      return res.status(503).json({ code: 'COMPLIANCE_NOT_CONFIGURED', message: 'Trusted geolocation and operator policy are not configured; real-money access remains disabled.' });
    }
    const user = await User.findById(req.userId).select('kycStatus amlStatus dateOfBirth responsibleGaming').lean();
    if (!user || user.kycStatus !== 'verified' || user.amlStatus !== 'clear') {
      return res.status(403).json({ code: 'COMPLIANCE_HOLD', message: 'Verified KYC and cleared AML screening are required.' });
    }
    const dob = user.dateOfBirth ? new Date(user.dateOfBirth) : null;
    if (!dob || dob.getTime() > Date.now() - 18 * 365.25 * 86400000) {
      return res.status(403).json({ code: 'AGE_RESTRICTED', message: 'Verified age 18 or older is required.' });
    }
    if (user.responsibleGaming?.selfExclusionUntil && new Date(user.responsibleGaming.selfExclusionUntil) > new Date()) {
      return res.status(403).json({ code: 'SELF_EXCLUDED', message: 'Real-money access is blocked during self-exclusion.' });
    }
    const ip = req.socket.remoteAddress;
    if (!ip) return res.status(503).json({ code: 'GEOLOCATION_UNAVAILABLE', message: 'Client network location could not be established.' });
    const geoResponse = await fetch(geoUrl, {
      method: 'POST', headers: { Authorization: 'Bearer ' + geoToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ipAddress: ip, purpose: 'velt-real-money-eligibility' }),
      signal: AbortSignal.timeout(5000),
    });
    if (!geoResponse.ok) throw new Error('Geolocation provider request failed');
    const geo = await geoResponse.json() as any;
    if (geo?.isReliable !== true || geo?.isVpn === true || geo?.isProxy === true || geo?.isTor === true || geo?.isHosting === true ||
        !/^[A-Z]{2}$/.test(String(geo?.countryCode || '').toUpperCase())) {
      return res.status(403).json({ code: 'UNTRUSTED_LOCATION', message: 'Trusted, non-anonymised geolocation is required.' });
    }
    const countryCode = String(geo.countryCode).toUpperCase();
    const now = new Date();
    const policy = await JurisdictionPolicy.findOne({
      jurisdictionCode: countryCode, operatorEntity, status: 'enabled',
      permittedProducts: 'casino', licenceReference: { $exists: true, $ne: '' },
      evidenceReviewedAt: { $exists: true }, effectiveFrom: { $lte: now },
      $or: [{ effectiveUntil: { $exists: false } }, { effectiveUntil: null }, { effectiveUntil: { $gt: now } }],
    }).lean();
    if (!policy) return res.status(403).json({ code: 'JURISDICTION_NOT_AUTHORISED', message: 'Casino product is not authorised for this operator in the detected jurisdiction.' });
    req.jurisdictionCode = countryCode;
    return next();
  } catch (error) {
    console.error('Real-money eligibility check failed closed:', error);
    return res.status(503).json({ code: 'ELIGIBILITY_CHECK_UNAVAILABLE', message: 'Compliance eligibility could not be verified; real-money access remains disabled.' });
  }
};
