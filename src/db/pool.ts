import { Pool, type PoolConfig } from 'pg';

export function createPool(connectionString: string): Pool {
  const config: PoolConfig = { connectionString };
  if (/sslmode=require/i.test(connectionString)) {
    config.ssl = { rejectUnauthorized: false };
  }
  return new Pool(config);
}
