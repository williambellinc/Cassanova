import WithdrawalRequest from '../models/WithdrawalRequest';
import PayoutEvent from '../models/PayoutEvent';
import { VerifiedPayoutEvent } from '../payments/payment-provider.contract';
import { getOrCreateLedgerAccount, postLedgerEntry } from './ledger.service';

export async function processVerifiedPayoutEvent(event: VerifiedPayoutEvent) {
  const prior = await PayoutEvent.findOne({ provider: event.provider, providerEventId: event.providerEventId });
  if (prior) {
    if (prior.payloadHash !== event.rawPayloadHash) throw new Error('Payout event ID reused with different payload');
    return { duplicate: true, processed: true };
  }
  const withdrawal = await WithdrawalRequest.findOne({ merchantReference: event.merchantReference, provider: event.provider });
  if (!withdrawal) throw new Error('Payout withdrawal not found; hold event for reconciliation');
  if (withdrawal.providerPayoutId && withdrawal.providerPayoutId !== event.providerPayoutId) throw new Error('Provider payout ID mismatch');
  if (withdrawal.amountMinor !== event.amountMinor || withdrawal.currency !== event.currency) throw new Error('Payout amount or currency mismatch');
  if (!['submitted','approved'].includes(withdrawal.status)) {
    if (withdrawal.status === 'paid' && event.status === 'paid') return { duplicate: true, processed: true };
    throw new Error('Withdrawal is not in a settleable state');
  }
  const liability = await getOrCreateLedgerAccount({ ownerType:'system', ownerId:'velt-withdrawals', accountType:'withdrawal_liability', currency:event.currency });
  const wallet = await getOrCreateLedgerAccount({ ownerType:'user', ownerId:String(withdrawal.userId), accountType:'player_wallet', currency:event.currency });
  const clearing = await getOrCreateLedgerAccount({ ownerType:'system', ownerId:event.provider, accountType:'payment_clearing', currency:event.currency });
  await PayoutEvent.create({
    provider:event.provider, providerEventId:event.providerEventId, merchantReference:event.merchantReference,
    providerPayoutId:event.providerPayoutId, amountMinor:event.amountMinor, currency:event.currency,
    status:event.status, payloadHash:event.rawPayloadHash,
  });
  if (event.status === 'paid') {
    await postLedgerEntry({
      lines:[{accountId:String(liability._id),direction:'debit',amountMinor:event.amountMinor},{accountId:String(clearing._id),direction:'credit',amountMinor:event.amountMinor}],
      currency:event.currency,idempotencyKey:'payout-settled:'+event.provider+':'+event.providerEventId,
      reference:event.merchantReference,description:'Verified player withdrawal paid',
      metadata:{provider:event.provider,providerPayoutId:event.providerPayoutId},
    });
    withdrawal.status='paid'; withdrawal.settledAt=new Date();
  } else {
    await postLedgerEntry({
      lines:[{accountId:String(liability._id),direction:'debit',amountMinor:event.amountMinor},{accountId:String(wallet._id),direction:'credit',amountMinor:event.amountMinor}],
      currency:event.currency,idempotencyKey:'payout-release:'+event.provider+':'+event.providerEventId,
      reference:event.merchantReference,description:'Failed payout returned to player wallet',
      metadata:{provider:event.provider,providerPayoutId:event.providerPayoutId},
    });
    withdrawal.status='failed'; withdrawal.failureReason='Provider confirmed payout failure; reserved funds released.';
  }
  await withdrawal.save();
  return {duplicate:false,processed:true,status:withdrawal.status};
}
