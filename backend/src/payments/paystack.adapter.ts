import { createHmac, createHash, timingSafeEqual } from 'crypto';
import { PaymentProviderAdapter, VerifiedPaymentEvent } from './payment-provider.contract';

/** Paystack REST adapter. Use test secret keys for sandbox validation. */
export class PaystackAdapter implements PaymentProviderAdapter {
  readonly providerId = 'paystack';
  private readonly baseUrl = 'https://api.paystack.co';
  constructor(private readonly secretKey: string) { if (!secretKey) throw new Error('Paystack secret key is required'); }

  async verifyWebhook(rawBody: Buffer, signature: string): Promise<boolean> {
    if (!signature) return false;
    if (signature.includes('t=') && signature.includes('v1=')) {
      const parts = signature.split(',').map(v => v.trim());
      const timestamp = parts.find(v => v.startsWith('t='))?.slice(2);
      const candidates = parts.filter(v => v.startsWith('v1=')).map(v => v.slice(3).split(':').pop() || '');
      const seconds = Number(timestamp);
      if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) return false;
      const expected = createHmac('sha512', this.secretKey).update(String(timestamp) + '.').update(rawBody).digest('hex');
      return candidates.some(v => { if (!/^[a-f0-9]{128}$/i.test(v)) return false; const a=Buffer.from(v,'hex'), b=Buffer.from(expected,'hex'); return a.length===b.length && timingSafeEqual(a,b); });
    }
    const expected = createHmac('sha512', this.secretKey).update(rawBody).digest('hex');
    if (!/^[a-f0-9]{128}$/i.test(signature)) return false;
    const a=Buffer.from(signature,'hex'), b=Buffer.from(expected,'hex');
    return a.length===b.length && timingSafeEqual(a,b);
  }

  async createDepositIntent(input: { merchantReference:string; amountMinor:number; currency:string; returnUrl:string; customerEmail:string }): Promise<{providerPaymentId?:string;redirectUrl?:string}> {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor<=0) throw new Error('Invalid amountMinor');
    const response=await fetch(this.baseUrl+'/transaction/initialize',{method:'POST',headers:{Authorization:'Bearer '+this.secretKey,'Content-Type':'application/json'},body:JSON.stringify({email:input.customerEmail,amount:input.amountMinor,currency:input.currency,reference:input.merchantReference,callback_url:input.returnUrl})});
    const payload=await response.json() as any;
    if(!response.ok || payload?.status!==true || !payload?.data?.authorization_url) throw new Error(payload?.message || 'Paystack could not initialize checkout');
    return {providerPaymentId:String(payload.data.reference),redirectUrl:payload.data.authorization_url};
  }

  async parseWebhook(rawBody:Buffer):Promise<VerifiedPaymentEvent>{
    const hook=JSON.parse(rawBody.toString('utf8')) as any, data=hook?.data;
    if(!['charge.success','charge.failed'].includes(String(hook?.event)) || !data?.reference) throw new Error('Paystack event is not a supported transaction event');
    const reference=String(data.reference);
    const response=await fetch(this.baseUrl+'/transaction/verify/'+encodeURIComponent(reference),{headers:{Authorization:'Bearer '+this.secretKey}});
    const payload=await response.json() as any;
    if(!response.ok || payload?.status!==true || !payload?.data) throw new Error('Paystack transaction verification failed');
    const tx=payload.data;
    if(String(tx.reference)!==reference || String(tx.currency).toUpperCase()!==String(data.currency).toUpperCase() || Number(tx.amount)!==Number(data.amount)) throw new Error('Paystack verified transaction does not match webhook');
    const success=tx.status==='success';
    if(!success && !['failed','abandoned'].includes(String(tx.status))) throw new Error('Paystack transaction is not final');
    const amountMinor=Number(tx.amount); if(!Number.isSafeInteger(amountMinor)||amountMinor<=0) throw new Error('Invalid Paystack transaction amount');
    return {provider:this.providerId,providerEventId:'paystack:'+tx.id+':'+tx.status,providerPaymentId:String(tx.id),merchantReference:reference,amountMinor,currency:String(tx.currency).toUpperCase(),status:success?'settled':'failed',occurredAt:tx.paid_at?new Date(tx.paid_at):new Date(),rawPayloadHash:createHash('sha256').update(rawBody).digest('hex')};
  }

  async parsePayoutWebhook(rawBody: Buffer) {
    const hook = JSON.parse(rawBody.toString('utf8')) as any, data = hook?.data;
    if (!['transfer.success','transfer.failed','transfer.reversed'].includes(String(hook?.event)) || !data?.reference) throw new Error('Unsupported Paystack payout event');
    const reference = String(data.reference);
    const response = await fetch(this.baseUrl + '/transfer/verify/' + encodeURIComponent(reference), { headers: { Authorization: 'Bearer ' + this.secretKey } });
    const payload = await response.json() as any;
    if (!response.ok || payload?.status !== true || !payload?.data) throw new Error('Paystack transfer verification failed');
    const tx = payload.data;
    if (String(tx.reference) !== reference || String(tx.currency).toUpperCase() !== String(data.currency).toUpperCase() || Number(tx.amount) !== Number(data.amount)) throw new Error('Verified Paystack transfer does not match webhook');
    const status = tx.status === 'success' ? 'paid' : ['failed','reversed'].includes(String(tx.status)) ? 'failed' : null;
    if (!status) throw new Error('Paystack transfer is not in a final state');
    return { provider: this.providerId, providerEventId: 'paystack-transfer:' + tx.id + ':' + tx.status, merchantReference: reference,
      providerPayoutId: String(tx.transfer_code || tx.id), amountMinor: Number(tx.amount), currency: String(tx.currency).toUpperCase(),
      status, rawPayloadHash: createHash('sha256').update(rawBody).digest('hex') as string };
  }

  async requestPayout(input:{merchantReference:string;amountMinor:number;currency:string;beneficiaryReference:string}):Promise<{providerPayoutId:string}>{
    if(!Number.isSafeInteger(input.amountMinor)||input.amountMinor<=0) throw new Error('Invalid payout amount');
    if(!/^RCP_[A-Za-z0-9]+$/.test(input.beneficiaryReference)) throw new Error('A Paystack transfer recipient code is required');
    const response=await fetch(this.baseUrl+'/transfer',{method:'POST',headers:{Authorization:'Bearer '+this.secretKey,'Content-Type':'application/json'},body:JSON.stringify({source:'balance',amount:input.amountMinor,currency:input.currency,reference:input.merchantReference,recipient:input.beneficiaryReference,reason:'VELT approved player withdrawal'})});
    const payload=await response.json() as any;
    if(!response.ok||payload?.status!==true||!payload?.data?.transfer_code) throw new Error(payload?.message||'Paystack transfer initiation failed');
    return {providerPayoutId:String(payload.data.transfer_code)};
  }
}