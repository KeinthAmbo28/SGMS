export const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','trainer','staff','member')),
  member_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trainers (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  specialty TEXT,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  membership_type TEXT NOT NULL CHECK(membership_type IN ('monthly','annual')),
  join_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  assigned_trainer_id TEXT,
  phone TEXT,
  email TEXT,
  emergency_contact TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(assigned_trainer_id) REFERENCES trainers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  check_in_at TEXT NOT NULL,
  check_out_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT NOT NULL CHECK(method IN ('cash','card','gcash','bank')),
  paid_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reset_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attendance_checkin ON attendance(check_in_at);
CREATE INDEX IF NOT EXISTS idx_payments_paidat ON payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_members_trainer ON members(assigned_trainer_id);
`;

