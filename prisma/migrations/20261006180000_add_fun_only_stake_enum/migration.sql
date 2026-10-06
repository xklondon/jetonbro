-- PostgreSQL: add enum value only. Do not use FUN_ONLY in this migration.
ALTER TYPE "StakeType" ADD VALUE IF NOT EXISTS 'FUN_ONLY';
