import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import User from '../models/User';
import PayoutBeneficiary from '../models/PayoutBeneficiary';
import { paymentProviders } from '../payments/payment-provider.contract';

const normaliseName = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');

export const createPayoutBeneficiary = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.status(401).json({ message: 'Authentication required' });
  const currency=String(req.body?.currency||'').toUpperCase();
  const bankCode=String(req.body?.bankCode||'').trim();
  const accountNumber=String(req.body?.accountNumber||'').trim();
  const providerId=String(req.body?.provider||process.env.PAYMENT_PROVIDER_ID||'');
  if(!/^[A-Z]{3}$/.test(currency)||!bankCode||bankCode.length>32||!/^[0-9A-Za-z]{5,34}$/.test(accountNumber)) return res.status(400).json({message:'Valid currency, bank code and account number are required'});
  const user=await User.findById(req.userId).select('firstName lastName kycStatus amlStatus');
  if(!user||user.kycStatus!=='verified'||user.amlStatus!=='clear'||!user.firstName||!user.lastName) return res.status(403).json({message:'Verified identity and AML clearance are required before adding a payout account'});
  const provider=paymentProviders.get(providerId);
  if(!provider?.createBeneficiary) return res.status(503).json({message:'Beneficiary registration is not configured for this payment provider'});
  try {
    const created=await provider.createBeneficiary({name:user.firstName+' '+user.lastName,accountNumber,bankCode,currency});
    if(normaliseName(created.verifiedName)!==normaliseName(user.firstName+' '+user.lastName)) {
      return res.status(409).json({message:'Provider-resolved account holder name does not match the verified player identity. Beneficiary was not linked.'});
    }
    const beneficiary=await PayoutBeneficiary.create({
      userId:user._id,provider:providerId,providerReference:created.providerReference,currency,
      verifiedAt:new Date(),verificationMethod:providerId+'-account-name-resolution',status:'verified',
    });
    return res.status(201).json({beneficiaryId:beneficiary._id,provider:providerId,currency,verifiedName:created.verifiedName,status:'verified'});
  } catch(error) {
    console.error('Payout beneficiary registration failed:',error);
    return res.status(502).json({message:'Unable to verify and register payout beneficiary'});
  }
};
