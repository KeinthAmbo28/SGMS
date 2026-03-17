import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { schemaSql } from "./schema.js";

function hasTable(db, name) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(name);
  return !!row;
}

function hasColumn(db, table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === column);
}

function usersAllowsMemberRole(db) {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
  const sql = row?.sql || "";
  return sql.includes("'member'");
}

function migrateUsersForMemberPortal(db) {
  if (hasColumn(db, "users", "member_id") && usersAllowsMemberRole(db)) return;

  db.exec(`
    PRAGMA foreign_keys=OFF;
    BEGIN;

    CREATE TABLE IF NOT EXISTS users_new (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','trainer','staff','member')),
      member_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE SET NULL
    );

    INSERT INTO users_new (id, username, password_hash, role, member_id, created_at)
    SELECT id, username, password_hash, role, NULL as member_id, created_at
    FROM users;

    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;

    COMMIT;
    PRAGMA foreign_keys=ON;
  `);
}

function migrateAttendanceForCheckout(db) {
  if (!hasTable(db, "attendance")) return;
  if (!hasColumn(db, "attendance", "check_out_at")) {
    db.exec("ALTER TABLE attendance ADD COLUMN check_out_at TEXT");
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_attendance_checkout ON attendance(check_out_at)");
}

export function initDb(db) {
  db.exec(schemaSql);

  if (!hasTable(db, "users")) return;

  // Lightweight migrations for existing sqlite file (must run after base tables exist)
  migrateUsersForMemberPortal(db);
  migrateAttendanceForCheckout(db);

  const admin = db.prepare("SELECT * FROM users WHERE username=?").get("admin");
  if (!admin) {
    const passwordHash = bcrypt.hashSync("admin123", 10);
    db.prepare(
      "INSERT INTO users (id, username, password_hash, role) VALUES (@id, @username, @password_hash, @role)"
    ).run({
      id: nanoid(),
      username: "admin",
      password_hash: passwordHash,
      role: "admin"
    });
  }

  const trainerCount = db.prepare("SELECT COUNT(*) as c FROM trainers").get().c;
  if (trainerCount === 0) {
    const t1 = { id: nanoid(), full_name: "Lisa Smith", specialty: "Strength", phone: "0917-000-0001", email: "lisa@smartgym.local", status: "active" };
    const t2 = { id: nanoid(), full_name: "Mark Dela Cruz", specialty: "Cardio", phone: "0917-000-0002", email: "mark@smartgym.local", status: "active" };
    db.prepare("INSERT INTO trainers (id, full_name, specialty, phone, email, status) VALUES (@id,@full_name,@specialty,@phone,@email,@status)").run(t1);
    db.prepare("INSERT INTO trainers (id, full_name, specialty, phone, email, status) VALUES (@id,@full_name,@specialty,@phone,@email,@status)").run(t2);
  }

  const memberCount = db.prepare("SELECT COUNT(*) as c FROM members").get().c;
  if (memberCount === 0) {
    const [firstTrainer] = db.prepare("SELECT id FROM trainers ORDER BY created_at ASC LIMIT 1").all();
    const trainerId = firstTrainer?.id ?? null;
    const m1 = { id: nanoid(), full_name: "John Doe", membership_type: "annual", join_date: "2026-03-01", status: "active", assigned_trainer_id: trainerId, phone: "0917-000-1001", email: "john@smartgym.local", emergency_contact: "Jane Doe 0917-000-2001", notes: "" };
    const m2 = { id: nanoid(), full_name: "Jane Cruz", membership_type: "monthly", join_date: "2026-03-05", status: "active", assigned_trainer_id: null, phone: "0917-000-1002", email: "jane@smartgym.local", emergency_contact: "Juan Cruz 0917-000-2002", notes: "" };
    const stmt = db.prepare("INSERT INTO members (id, full_name, membership_type, join_date, status, assigned_trainer_id, phone, email, emergency_contact, notes) VALUES (@id,@full_name,@membership_type,@join_date,@status,@assigned_trainer_id,@phone,@email,@emergency_contact,@notes)");
    stmt.run(m1);
    stmt.run(m2);

    const now = new Date("2026-03-17T12:00:00Z");
    const attendanceStmt = db.prepare(
      "INSERT INTO attendance (id, member_id, check_in_at, check_out_at) VALUES (@id,@member_id,@check_in_at,@check_out_at)"
    );
    const paymentStmt = db.prepare("INSERT INTO payments (id, member_id, amount, method, paid_at) VALUES (@id,@member_id,@amount,@method,@paid_at)");
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setUTCDate(now.getUTCDate() - (6 - i));
      const isoDate = d.toISOString().slice(0, 10);
      attendanceStmt.run({
        id: nanoid(),
        member_id: m1.id,
        check_in_at: `${isoDate}T09:00:00Z`,
        check_out_at: `${isoDate}T10:15:00Z`
      });
      attendanceStmt.run({
        id: nanoid(),
        member_id: m2.id,
        check_in_at: `${isoDate}T11:00:00Z`,
        check_out_at: `${isoDate}T12:05:00Z`
      });
    }
    paymentStmt.run({ id: nanoid(), member_id: m1.id, amount: 2500, method: "cash", paid_at: "2026-03-13T10:00:00Z" });
    paymentStmt.run({ id: nanoid(), member_id: m2.id, amount: 500, method: "gcash", paid_at: "2026-03-15T10:00:00Z" });
  }
}

