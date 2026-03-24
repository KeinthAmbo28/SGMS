export const schemaSql = `
CREATE TABLE IF NOT EXISTS trainers (
  id VARCHAR(255) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  specialty VARCHAR(255),
  phone VARCHAR(255),
  email VARCHAR(255),
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS members (
  id VARCHAR(255) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  membership_type ENUM('monthly','annual') NOT NULL,
  join_date DATE NOT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  assigned_trainer_id VARCHAR(255),
  phone VARCHAR(255),
  email VARCHAR(255),
  emergency_contact TEXT,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  FOREIGN KEY(assigned_trainer_id) REFERENCES trainers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','trainer','staff','member') NOT NULL,
  member_id VARCHAR(255),
  status ENUM('active','frozen') NOT NULL DEFAULT 'active',
  last_active_at DATETIME,
  frozen_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS account_freeze_settings (
  id INT PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  inactive_days INT NOT NULL DEFAULT 30,
  include_never_used BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at DATETIME NOT NULL DEFAULT NOW(),
  last_run_at DATETIME
);

CREATE TABLE IF NOT EXISTS attendance (
  id VARCHAR(255) PRIMARY KEY,
  member_id VARCHAR(255) NOT NULL,
  check_in_at DATETIME NOT NULL,
  check_out_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(255) PRIMARY KEY,
  member_id VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  method ENUM('cash','card','gcash','bank') NOT NULL,
  paid_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_resets (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  reset_at DATETIME NOT NULL DEFAULT NOW(),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_attendance_checkin ON attendance(check_in_at);
CREATE INDEX idx_payments_paidat ON payments(paid_at);
CREATE INDEX idx_members_trainer ON members(assigned_trainer_id);
`;

