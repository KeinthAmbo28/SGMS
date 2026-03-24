import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { schemaSql } from "./schema.js";

async function hasTable(db, name) {
  const [rows] = await db.execute(`SHOW TABLES LIKE '${name}'`);
  return rows.length > 0;
}

async function hasColumn(db, table, column) {
  const [rows] = await db.execute(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
  return rows.length > 0;
}

async function usersAllowsMemberRole(db) {
  // For MySQL, we'll assume the role enum includes 'member' after schema update
  return true;
}

async function migrateUsersForMemberPortal(db) {
  let needsMigration = false;

  if (!(await hasColumn(db, "users", "status"))) {
    await db.execute("ALTER TABLE users ADD COLUMN status ENUM('active','frozen') NOT NULL DEFAULT 'active'");
    needsMigration = true;
  }
  if (!(await hasColumn(db, "users", "last_active_at"))) {
    await db.execute("ALTER TABLE users ADD COLUMN last_active_at DATETIME");
    needsMigration = true;
  }
  if (!(await hasColumn(db, "users", "frozen_at"))) {
    await db.execute("ALTER TABLE users ADD COLUMN frozen_at DATETIME");
    needsMigration = true;
  }

  if (await hasColumn(db, "users", "member_id") && await usersAllowsMemberRole(db)) return;

  // For MySQL, we'll recreate the table if needed
  if (needsMigration) {
    await db.execute(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS status ENUM('active','frozen') NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS last_active_at DATETIME,
      ADD COLUMN IF NOT EXISTS frozen_at DATETIME
    `);
  }
}

async function migrateAttendanceForCheckout(db) {
  if (!(await hasTable(db, "attendance"))) return;
  if (!(await hasColumn(db, "attendance", "check_out_at"))) {
    await db.execute("ALTER TABLE attendance ADD COLUMN check_out_at DATETIME");
  }
  await db.execute("CREATE INDEX IF NOT EXISTS idx_attendance_checkout ON attendance(check_out_at)");
}

export async function initDb(db) {
  // Split schema SQL and execute each statement
  const statements = schemaSql.split(';').filter(stmt => stmt.trim());
  for (const stmt of statements) {
    if (stmt.trim()) {
      await db.execute(stmt);
    }
  }

  if (!(await hasTable(db, "users"))) return;

  // Lightweight migrations for existing database
  await migrateUsersForMemberPortal(db);
  await migrateAttendanceForCheckout(db);

  // Create the index only after migration adds the column.
  await db.execute("CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at)");

  // Ensure freeze settings row exists (single-row settings table).
  const [settingsRows] = await db.execute("SELECT id FROM account_freeze_settings WHERE id=1");
  if (settingsRows.length === 0) {
    await db.execute("INSERT INTO account_freeze_settings (id) VALUES (1)");
  }

  const [adminRows] = await db.execute("SELECT * FROM users WHERE username=?", ["admin"]);
  if (adminRows.length === 0) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    await db.execute(
      "INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)",
      [nanoid(), "admin", passwordHash, "admin"]
    );
  }

  // Removed sample data creation - database will start empty except for admin user
}

