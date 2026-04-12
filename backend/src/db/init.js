import bcrypt from "bcryptjs";
import { schemaSql } from "./schema.js";

async function hasTable(db, name) {
  const [rows] = await db.query(`SHOW TABLES LIKE '${name}'`);
  return rows.length > 0;
}

async function hasColumn(db, table, column) {
  const [rows] = await db.query(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
  return rows.length > 0;
}

async function usersAllowsMemberRole(db) {
  return true;
}

// ✅ USERS MIGRATION (FIXED)
async function migrateUsersForMemberPortal(db) {
  if (!(await hasColumn(db, "users", "status"))) {
    await db.query(
      "ALTER TABLE users ADD COLUMN status ENUM('active','frozen') NOT NULL DEFAULT 'active'"
    );
  }

  if (!(await hasColumn(db, "users", "last_active_at"))) {
    await db.query(
      "ALTER TABLE users ADD COLUMN last_active_at DATETIME"
    );
  }

  if (!(await hasColumn(db, "users", "frozen_at"))) {
    await db.query(
      "ALTER TABLE users ADD COLUMN frozen_at DATETIME"
    );
  }
}

// ✅ ATTENDANCE MIGRATION (FIXED)
async function migrateAttendanceForCheckout(db) {
  if (!(await hasTable(db, "attendance"))) return;

  if (!(await hasColumn(db, "attendance", "check_out_at"))) {
    await db.query(
      "ALTER TABLE attendance ADD COLUMN check_out_at DATETIME"
    );
  }

  // ✅ SAFE INDEX CREATION
  try {
    await db.query(
      "CREATE INDEX idx_attendance_checkout ON attendance(check_out_at)"
    );
  } catch (err) {
    if (!err.message.includes("Duplicate")) {
      console.error(err);
    }
  }
}

// ✅ MEMBERS MIGRATION
async function migrateMembersProfilePicture(db) {
  if (!(await hasTable(db, "members"))) return;

  if (!(await hasColumn(db, "members", "profile_picture"))) {
    await db.query(
      "ALTER TABLE members ADD COLUMN profile_picture VARCHAR(255)"
    );
  }
}

// ✅ MAIN INIT FUNCTION
export async function initDb(db) {
  // Run schema
  const statements = schemaSql.split(";").filter(stmt => stmt.trim());

  for (const stmt of statements) {
    await db.query(stmt);
  }

  if (!(await hasTable(db, "users"))) return;

  // Run migrations
  await migrateUsersForMemberPortal(db);
  await migrateAttendanceForCheckout(db);
  await migrateMembersProfilePicture(db);

  // ✅ SAFE INDEX (FIXED)
  try {
    await db.query(
      "CREATE INDEX idx_users_last_active ON users(last_active_at)"
    );
  } catch (err) {
    if (!err.message.includes("Duplicate")) {
      console.error(err);
    }
  }

  // Ensure settings row exists
  const [settingsRows] = await db.query(
    "SELECT id FROM account_freeze_settings WHERE id=1"
  );

  if (settingsRows.length === 0) {
    await db.query(
      "INSERT INTO account_freeze_settings (id) VALUES (1)"
    );
  }

  // Ensure admin user exists
  const [adminRows] = await db.query(
    "SELECT * FROM users WHERE username=?",
    ["admin"]
  );

  if (adminRows.length === 0) {
    const passwordHash = await bcrypt.hash("admin123", 10);

    await db.query(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
      ["admin", passwordHash, "admin"]
    );
  }
}