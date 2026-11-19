import { createHash, createHmac, randomBytes } from 'crypto';

/**
 * HMAC-SHA256 counter-mode entropy for auditable practice rounds.
 * Commitment is published before outcome generation; seed is revealed with
 * the completed practice round. Production wagering needs independent lab review.
 */
export function createFairRoundRandom(clientSeed = 'velt-practice', nonce = 0) {
  if (!clientSeed || clientSeed.length > 128 || !Number.isSafeInteger(nonce) || nonce < 0) throw new Error('Invalid fairness context');
  const serverSeed = randomBytes(32).toString('hex');
  const serverSeedHash = createHash('sha256').update(serverSeed).digest('hex');
  let counter = 0;
  const bytes = (length: number) => {
    const out: Buffer[] = [];
    while (Buffer.concat(out).length < length) {
      const digest = createHmac('sha256', Buffer.from(serverSeed, 'hex'))
        .update(clientSeed + ':' + nonce + ':' + counter++).digest();
      out.push(digest);
    }
    return Buffer.concat(out).subarray(0, length);
  };
  const integer = (min: number, maxExclusive: number) => {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(maxExclusive) || maxExclusive <= min) throw new Error('Invalid random integer range');
    const range = maxExclusive - min;
    const space = 2 ** 32;
    const limit = Math.floor(space / range) * range;
    while (true) {
      const value = bytes(4).readUInt32BE(0);
      if (value < limit) return min + (value % range);
    }
  };
  return {
    integer,
    fairness: { algorithm: 'HMAC-SHA256-counter-v1', clientSeed, nonce, serverSeedHash, serverSeed },
  };
}
