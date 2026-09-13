CREATE TABLE wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('master', 'game')),
  table_id TEXT,
  balance INTEGER NOT NULL
);

CREATE UNIQUE INDEX wallets_one_master ON wallets (user_id) WHERE type = 'master';
CREATE UNIQUE INDEX wallets_one_game ON wallets (user_id, table_id) WHERE type = 'game';

CREATE TABLE escrows (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  state TEXT NOT NULL,
  resolved_by TEXT,
  payout JSONB
);

CREATE TABLE escrow_ledger (
  n BIGSERIAL,
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  kind TEXT NOT NULL,
  escrow_id TEXT,
  from_state TEXT,
  to_state TEXT,
  declared_by TEXT,
  detail TEXT
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT,
  phone TEXT,
  device_id TEXT,
  is_guest BOOLEAN NOT NULL,
  accepted_terms_at TEXT,
  created_at TEXT NOT NULL,
  upgraded_from_user_id TEXT
);

CREATE TABLE tables (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  protocol_id TEXT NOT NULL
);

CREATE TABLE invites (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL,
  invited_email TEXT,
  invited_phone TEXT,
  opening_chips INTEGER NOT NULL,
  claimed_by_user_id TEXT,
  opening_credited BOOLEAN NOT NULL,
  magic_token TEXT,
  join_path TEXT NOT NULL
);

CREATE TABLE magic_links (
  token TEXT PRIMARY KEY,
  email TEXT,
  phone TEXT,
  invite_id TEXT,
  guest_device_id TEXT
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL
);

CREATE TABLE memberships (
  table_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (table_id, user_id)
);

CREATE TABLE personal_ledger_entries (
  n BIGSERIAL,
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  table_id TEXT,
  ts TEXT NOT NULL,
  escrow_id TEXT,
  actor_id TEXT
);

CREATE TABLE personal_ledger_snapshots (
  n BIGSERIAL,
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  user_id TEXT NOT NULL,
  other_user_id TEXT,
  standings JSONB NOT NULL
);

CREATE TABLE table_runtimes (
  table_id TEXT PRIMARY KEY,
  protocol JSONB NOT NULL,
  box_escrow_ids JSONB NOT NULL
);
