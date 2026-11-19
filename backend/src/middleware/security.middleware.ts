import { Request, Response, NextFunction } from 'express';

type Bucket = { count: number; resetAt: number };

/**
 * Lightweight per-process limiter for early deployments.
 * Production multi-instance deployments must replace this with a shared store
 * (for example Redis) and configure trusted proxy handling deliberately.
 */
export const createRateLimiter = (options: { windowMs: number; max: number; message?: string }) => {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    res.setHeader('RateLimit-Limit', String(options.max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, options.max - bucket.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > options.max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return res.status(429).json({
        message: options.message || 'Too many requests. Please try again later.',
        code: 'RATE_LIMITED',
      });
    }

    // Bound memory if an attacker cycles source IPs. This is not a substitute
    // for a distributed limiter or edge-level abuse protection.
    if (buckets.size > 10000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
        if (buckets.size <= 8000) break;
      }
    }

    return next();
  };
};

export const securityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Cache-Control', 'no-store');
  return next();
};
