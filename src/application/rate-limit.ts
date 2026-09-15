import { DomainError } from "@/domain/errors";

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): void {
  const bucket = buckets.get(key) ?? { timestamps: [] };
  const cutoff = now - windowMs;
  bucket.timestamps = bucket.timestamps.filter((time) => time > cutoff);
  if (bucket.timestamps.length >= max) {
    throw new DomainError("RATE_LIMITED", "Please wait before trying again.", 429);
  }
  bucket.timestamps.push(now);
  buckets.set(key, bucket);
}
