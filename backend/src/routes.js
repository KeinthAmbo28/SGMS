import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { signToken, requireRole } from "./auth.js";
import {
  attendanceCreateSchema,
  accountFreezeSettingsSchema,
  loginSchema,
  memberRegisterSchema,
  memberCreateSchema,
  paymentCreateSchema,
  trainerCreateSchema,
  userUpsertSchema
} from "./validators.js";

import { getAccountFreezeSettings, runAccountFreeze, updateAccountFreezeSettings } from "./accountFreeze.js";

function ok(res, data) {
  return res.json(data);
}

function badRequest(res, message, details) {
  return res.status(400).json({ error: message, details });
}

export function registerRoutes(app, db, requireAuth) {
  app.get("/api/health", (req, res) => ok(res, { ok: true }));

  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());
    const [userRows] = await db.execute("SELECT * FROM users WHERE username=?", [parsed.data.username]);
    const user = userRows[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    if (user.status === "frozen") return res.status(403).json({ error: "Account frozen" });
    const passOk = await bcrypt.compare(parsed.data.password, user.password_hash);
    if (!passOk) return res.status(401).json({ error: "Invalid credentials" });
    await db.execute("UPDATE users SET last_active_at=NOW() WHERE id=?", [user.id]);
    const token = signToken(user);
    return ok(res, { token, user: { id: user.id, username: user.username, role: user.role } });
  });

  // Member portal auth (separate endpoint for clarity in UI)
  app.post("/api/member/register", async (req, res) => {
    const parsed = memberRegisterSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());

    const [existsRows] = await db.execute("SELECT id FROM users WHERE username=?", [parsed.data.username]);
    if (existsRows.length > 0) return res.status(409).json({ error: "Username already exists" });

    const memberId = nanoid();
    const join_date = new Date().toISOString().slice(0, 10);
    await db.execute(
      `
      INSERT INTO members
      (id, full_name, membership_type, join_date, status, assigned_trainer_id, phone, email, emergency_contact, notes)
      VALUES
      (?, ?, ?, ?, 'active', NULL, ?, ?, NULL, NULL)
    `,
      [memberId, parsed.data.full_name, parsed.data.membership_type, join_date, parsed.data.phone ?? null, parsed.data.email ?? null]
    );

    const userId = nanoid();
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    await db.execute(
      "INSERT INTO users (id, username, password_hash, role, member_id) VALUES (?, ?, ?, ?, ?)",
      [userId, parsed.data.username, passwordHash, "member", memberId]
    );
    await db.execute("UPDATE users SET last_active_at=NOW() WHERE id=?", [userId]);

    const user = { id: userId, username: parsed.data.username, role: "member" };
    const token = signToken(user);
    return ok(res, { token, user });
  });

  app.post("/api/member/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());
    const [userRows] = await db.execute("SELECT * FROM users WHERE username=?", [parsed.data.username]);
    const user = userRows[0];
    if (!user || user.role !== "member") return res.status(401).json({ error: "Invalid credentials" });
    if (user.status === "frozen") return res.status(403).json({ error: "Account frozen" });
    const passOk = await bcrypt.compare(parsed.data.password, user.password_hash);
    if (!passOk) return res.status(401).json({ error: "Invalid credentials" });
    await db.execute("UPDATE users SET last_active_at=NOW() WHERE id=?", [user.id]);
    const token = signToken(user);
    return ok(res, { token, user: { id: user.id, username: user.username, role: user.role } });
  });

  app.get("/api/me", requireAuth, (req, res) => ok(res, { user: req.user }));

  // Member portal API (requires member auth)
  app.get("/api/member/me", requireAuth, requireRole("member"), async (req, res) => {
    const [userRows] = await db.execute("SELECT id, username, role, member_id FROM users WHERE id=?", [req.user.id]);
    const user = userRows[0];
    const [memberRows] = await db.execute(
      `
        SELECT m.*, t.full_name as trainer_name
        FROM members m
        LEFT JOIN trainers t ON t.id = m.assigned_trainer_id
        WHERE m.id=?
      `,
      [user.member_id]
    );
    const member = memberRows[0];

    const [openRows] = await db.execute(
      `
        SELECT *
        FROM attendance
        WHERE member_id=? AND check_out_at IS NULL
        ORDER BY check_in_at DESC
        LIMIT 1
      `,
      [user.member_id]
    );

    return ok(res, { user, member, openAttendance: openRows[0] || null });
  });

  app.get("/api/member/trainers", requireAuth, requireRole("member"), async (req, res) => {
    const [trainers] = await db.execute(
      `
        SELECT t.*,
          (SELECT COUNT(*) FROM members m WHERE m.assigned_trainer_id = t.id AND m.status='active') as assigned_members
        FROM trainers t
        WHERE t.status='active'
        ORDER BY t.full_name ASC
      `
    );
    ok(res, { trainers });
  });

  app.post("/api/member/select-trainer", requireAuth, requireRole("member"), async (req, res) => {
    const [userRows] = await db.execute("SELECT member_id FROM users WHERE id=?", [req.user.id]);
    const user = userRows[0];
    const trainerId = req.body?.trainer_id || null;
    if (!trainerId) return badRequest(res, "trainer_id is required");
    const [trainerRows] = await db.execute("SELECT * FROM trainers WHERE id=? AND status='active'", [trainerId]);
    const trainer = trainerRows[0];
    if (!trainer) return res.status(404).json({ error: "Trainer not found" });
    await db.execute("UPDATE members SET assigned_trainer_id=? WHERE id=?", [trainerId, user.member_id]);
    ok(res, { ok: true });
  });

  app.post("/api/member/check-in", requireAuth, requireRole("member"), async (req, res) => {
    const [userRows] = await db.execute("SELECT member_id FROM users WHERE id=?", [req.user.id]);
    const user = userRows[0];
    const [openRows] = await db.execute(
      "SELECT id FROM attendance WHERE member_id=? AND check_out_at IS NULL ORDER BY check_in_at DESC LIMIT 1",
      [user.member_id]
    );
    if (openRows.length > 0) return res.status(409).json({ error: "Already checked in. Please check out first." });
    const id = nanoid();
    await db.execute("INSERT INTO attendance (id, member_id, check_in_at, check_out_at) VALUES (?, ?, ?, NULL)", [
      id,
      user.member_id,
      new Date().toISOString()
    ]);
    ok(res, { id });
  });

  app.post("/api/member/check-out", requireAuth, requireRole("member"), async (req, res) => {
    const [userRows] = await db.execute("SELECT member_id FROM users WHERE id=?", [req.user.id]);
    const user = userRows[0];
    const [openRows] = await db.execute(
      "SELECT id FROM attendance WHERE member_id=? AND check_out_at IS NULL ORDER BY check_in_at DESC LIMIT 1",
      [user.member_id]
    );
    if (openRows.length === 0) return res.status(409).json({ error: "No active check-in found." });
    await db.execute("UPDATE attendance SET check_out_at=? WHERE id=?", [new Date().toISOString(), openRows[0].id]);
    ok(res, { ok: true });
  });

  app.get("/api/member/attendance", requireAuth, requireRole("member"), async (req, res) => {
    const [userRows] = await db.execute("SELECT member_id FROM users WHERE id=?", [req.user.id]);
    const user = userRows[0];
    const [rows] = await db.execute(
      `
        SELECT *
        FROM attendance
        WHERE member_id=?
        ORDER BY check_in_at DESC
        LIMIT 50
      `,
      [user.member_id]
    );
    ok(res, { attendance: rows });
  });

  app.get("/api/dashboard/summary", requireAuth, async (req, res) => {
    const [membersRows] = await db.execute("SELECT COUNT(*) as c FROM members WHERE status='active'");
    const members = membersRows[0].c;
    const [trainersRows] = await db.execute("SELECT COUNT(*) as c FROM trainers WHERE status='active'");
    const trainers = trainersRows[0].c;
    // No dedicated "classes" table exists; we treat "classes today" as total check-ins today.
    const [classesRows] = await db.execute("SELECT COUNT(*) as c FROM attendance WHERE DATE(check_in_at) = CURDATE()");
    const classesToday = classesRows[0].c;
    const [revenueRows] = await db.execute(
      "SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE paid_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
    );
    const revenue = revenueRows[0].total;

    const [membershipRows] = await db.execute("SELECT membership_type, COUNT(*) as c FROM members GROUP BY membership_type");
    const membershipType = membershipRows.reduce(
      (acc, r) => ({ ...acc, [r.membership_type]: r.c }),
      { monthly: 0, annual: 0 }
    );

    const [attendanceRows] = await db.execute(
      `
        SELECT DATE(check_in_at) as day, COUNT(*) as c
        FROM attendance
        WHERE check_in_at >= DATE_SUB(NOW(), INTERVAL 6 DAY)
        GROUP BY DATE(check_in_at)
        ORDER BY day ASC
      `
    );

    const [paymentRows] = await db.execute(
      `
        SELECT DATE(paid_at) as day, COALESCE(SUM(amount),0) as total
        FROM payments
        WHERE paid_at >= DATE_SUB(NOW(), INTERVAL 6 DAY)
        GROUP BY DATE(paid_at)
        ORDER BY day ASC
      `
    );

    const [attendanceActivities] = await db.execute(
      `
        SELECT 'attendance' as type, m.full_name as who, a.check_in_at as at
        FROM attendance a
        JOIN members m ON m.id = a.member_id
        ORDER BY a.check_in_at DESC
        LIMIT 3
      `
    );
    const [paymentActivities] = await db.execute(
      `
        SELECT 'payment' as type, m.full_name as who, p.paid_at as at, p.amount as amount
        FROM payments p
        JOIN members m ON m.id = p.member_id
        ORDER BY p.paid_at DESC
        LIMIT 3
      `
    );

    const recentActivities = [
      ...attendanceActivities.map((r) => ({ text: `Member ${r.who} checked in`, at: r.at })),
      ...paymentActivities.map((r) => ({ text: `Payment received from ${r.who}`, at: r.at, amount: r.amount }))
    ]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 3);

    return ok(res, {
      kpis: { members, trainers, classesToday, revenue },
      membershipType,
      attendanceSeries: attendanceRows,
      paymentSeries: paymentRows,
      recentActivities
    });
  });

  // Members
  app.get("/api/members", requireAuth, async (req, res) => {
    const [rows] = await db.execute(
      `
        SELECT m.*, t.full_name as trainer_name
        FROM members m
        LEFT JOIN trainers t ON t.id = m.assigned_trainer_id
        ORDER BY m.created_at DESC
      `
    );
    ok(res, { members: rows });
  });

  app.post("/api/members", requireAuth, async (req, res) => {
    const parsed = memberCreateSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());
    const id = nanoid();
    await db.execute(
      `
      INSERT INTO members
      (id, full_name, membership_type, join_date, status, assigned_trainer_id, phone, email, emergency_contact, notes)
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [id, parsed.data.full_name, parsed.data.membership_type, parsed.data.join_date, parsed.data.status, parsed.data.assigned_trainer_id, parsed.data.phone, parsed.data.email, parsed.data.emergency_contact, parsed.data.notes]
    );
    ok(res, { id });
  });

  app.put("/api/members/:id", requireAuth, async (req, res) => {
    const parsed = memberCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());
    const [existingRows] = await db.execute("SELECT * FROM members WHERE id=?", [req.params.id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: "Not found" });
    const next = { ...existing, ...parsed.data };
    await db.execute(
      `
      UPDATE members SET
        full_name=?,
        membership_type=?,
        join_date=?,
        status=?,
        assigned_trainer_id=?,
        phone=?,
        email=?,
        emergency_contact=?,
        notes=?
      WHERE id=?
    `,
      [next.full_name, next.membership_type, next.join_date, next.status, next.assigned_trainer_id, next.phone, next.email, next.emergency_contact, next.notes, req.params.id]
    );
    ok(res, { ok: true });
  });

  app.delete("/api/members/:id", requireAuth, async (req, res) => {
    await db.execute("DELETE FROM members WHERE id=?", [req.params.id]);
    ok(res, { ok: true });
  });

  // Trainers
  app.get("/api/trainers", requireAuth, async (req, res) => {
    const [rows] = await db.execute("SELECT * FROM trainers ORDER BY created_at DESC");
    ok(res, { trainers: rows });
  });

  app.post("/api/trainers", requireAuth, async (req, res) => {
    const parsed = trainerCreateSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());
    const id = nanoid();
    await db.execute(
      "INSERT INTO trainers (id, full_name, specialty, phone, email, status) VALUES (?, ?, ?, ?, ?, ?)",
      [id, parsed.data.full_name, parsed.data.specialty, parsed.data.phone, parsed.data.email, parsed.data.status]
    );
    ok(res, { id });
  });

  app.put("/api/trainers/:id", requireAuth, async (req, res) => {
    const parsed = trainerCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());
    const [existingRows] = await db.execute("SELECT * FROM trainers WHERE id=?", [req.params.id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: "Not found" });
    const next = { ...existing, ...parsed.data };
    await db.execute(
      "UPDATE trainers SET full_name=?, specialty=?, phone=?, email=?, status=? WHERE id=?",
      [next.full_name, next.specialty, next.phone, next.email, next.status, req.params.id]
    );
    ok(res, { ok: true });
  });

  app.delete("/api/trainers/:id", requireAuth, async (req, res) => {
    await db.execute("DELETE FROM trainers WHERE id=?", [req.params.id]);
    ok(res, { ok: true });
  });

  // Attendance
  app.get("/api/attendance", requireAuth, async (req, res) => {
    const [rows] = await db.execute(
      `
        SELECT a.*, m.full_name as member_name
        FROM attendance a
        JOIN members m ON m.id = a.member_id
        ORDER BY a.check_in_at DESC
        LIMIT 200
      `
    );
    ok(res, { attendance: rows });
  });

  app.post("/api/attendance", requireAuth, async (req, res) => {
    const parsed = attendanceCreateSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());
    const id = nanoid();
    const check_in_at = parsed.data.check_in_at || new Date().toISOString();
    await db.execute("INSERT INTO attendance (id, member_id, check_in_at, check_out_at) VALUES (?, ?, ?, NULL)", [
      id,
      parsed.data.member_id,
      check_in_at
    ]);
    ok(res, { id });
  });

  // Payments
  app.get("/api/payments", requireAuth, async (req, res) => {
    const [rows] = await db.execute(
      `
        SELECT p.*, m.full_name as member_name
        FROM payments p
        JOIN members m ON m.id = p.member_id
        ORDER BY p.paid_at DESC
        LIMIT 200
      `
    );
    ok(res, { payments: rows });
  });

  app.post("/api/payments", requireAuth, async (req, res) => {
    const parsed = paymentCreateSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());
    const id = nanoid();
    const paid_at = parsed.data.paid_at || new Date().toISOString();
    await db.execute("INSERT INTO payments (id, member_id, amount, method, paid_at) VALUES (?, ?, ?, ?, ?)", [
      id,
      parsed.data.member_id,
      parsed.data.amount,
      parsed.data.method,
      paid_at
    ]);
    ok(res, { id });
  });

  // Reports
  app.get("/api/reports/overview", requireAuth, async (req, res) => {
    const [topMembers] = await db.execute(
      `
        SELECT m.full_name, COUNT(a.id) as checkins
        FROM members m
        LEFT JOIN attendance a ON a.member_id = m.id AND a.check_in_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY m.id
        ORDER BY checkins DESC
        LIMIT 5
      `
    );
    const [paymentByMethod] = await db.execute(
      `
        SELECT method, COALESCE(SUM(amount),0) as total
        FROM payments
        WHERE paid_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY method
      `
    );
    ok(res, { topMembers, paymentByMethod });
  });

  // Settings / Admin actions
  app.get("/api/admin/users", requireAuth, requireRole("admin"), async (req, res) => {
    const [users] = await db.execute("SELECT id, username, role, status, last_active_at, frozen_at, created_at FROM users ORDER BY created_at DESC");
    ok(res, { users });
  });

  app.post("/api/admin/users", requireAuth, requireRole("admin"), async (req, res) => {
    const parsed = userUpsertSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());
    const [existingRows] = await db.execute("SELECT * FROM users WHERE username=?", [parsed.data.username]);
    if (existingRows.length > 0) return res.status(409).json({ error: "Username already exists" });
    const id = nanoid();
    const passwordHash = await bcrypt.hash(parsed.data.password || "changeme123", 10);
    await db.execute("INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)", [
      id,
      parsed.data.username,
      passwordHash,
      parsed.data.role
    ]);
    ok(res, { id });
  });

  app.put("/api/admin/users/:id", requireAuth, requireRole("admin"), async (req, res) => {
    const parsed = userUpsertSchema.partial().safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());
    const [existingRows] = await db.execute("SELECT * FROM users WHERE id=?", [req.params.id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: "Not found" });
    const next = { ...existing, ...parsed.data };
    if (parsed.data.password) next.password_hash = await bcrypt.hash(parsed.data.password, 10);
    await db.execute("UPDATE users SET username=?, password_hash=?, role=? WHERE id=?", [
      next.username,
      next.password_hash,
      next.role,
      req.params.id
    ]);
    ok(res, { ok: true });
  });

  app.delete("/api/admin/users/:id", requireAuth, requireRole("admin"), async (req, res) => {
    await db.execute("DELETE FROM users WHERE id=?", [req.params.id]);
    ok(res, { ok: true });
  });

  // Account freezing (inactive -> frozen, then admin can reactivate)
  app.get("/api/admin/account-freeze/settings", requireAuth, requireRole("admin"), async (req, res) => {
    ok(res, { settings: await getAccountFreezeSettings(db) });
  });

  app.put("/api/admin/account-freeze/settings", requireAuth, requireRole("admin"), async (req, res) => {
    const parsed = accountFreezeSettingsSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());
    await updateAccountFreezeSettings(db, parsed.data);
    ok(res, { ok: true, settings: await getAccountFreezeSettings(db) });
  });

  app.post("/api/admin/account-freeze/run", requireAuth, requireRole("admin"), async (req, res) => {
    // `force: true` so the admin "Freeze Now" button works even if auto-freeze is disabled.
    const result = await runAccountFreeze(db, { force: true });
    ok(res, { ...result, settings: await getAccountFreezeSettings(db) });
  });

  app.post("/api/admin/users/:id/freeze", requireAuth, requireRole("admin"), async (req, res) => {
    const [existingRows] = await db.execute("SELECT id, role, status FROM users WHERE id=?", [req.params.id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.role === "admin") return res.status(400).json({ error: "Cannot freeze admin users" });
    if (existing.id === req.user.id) return res.status(400).json({ error: "You cannot freeze your own session" });
    if (existing.status === "frozen") return ok(res, { ok: true, alreadyFrozen: true });

    await db.execute("UPDATE users SET status='frozen', frozen_at=NOW() WHERE id=?", [req.params.id]);
    ok(res, { ok: true });
  });

  app.post("/api/admin/users/:id/reactivate", requireAuth, requireRole("admin"), async (req, res) => {
    const [existingRows] = await db.execute("SELECT id, role, status FROM users WHERE id=?", [req.params.id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.status !== "frozen") return ok(res, { ok: true, alreadyActive: true });

    await db.execute("UPDATE users SET status='active', frozen_at=NULL, last_active_at=NOW() WHERE id=?", [req.params.id]);
    ok(res, { ok: true });
  });

  app.post("/api/admin/reset-all-passwords", requireAuth, requireRole("admin"), async (req, res) => {
    const [users] = await db.execute("SELECT id FROM users");
    const hash = await bcrypt.hash("admin123", 10);
    for (const u of users) {
      await db.execute("UPDATE users SET password_hash=? WHERE id=?", [hash, u.id]);
      await db.execute("INSERT INTO password_resets (id, user_id) VALUES (?, ?)", [nanoid(), u.id]);
    }
    ok(res, { ok: true, newPassword: "admin123" });
  });

  app.get("/api/admin/backup", requireAuth, requireRole("admin"), async (req, res) => {
    const [users] = await db.execute("SELECT id, username, role, status, last_active_at, frozen_at, created_at FROM users");
    const [trainers] = await db.execute("SELECT * FROM trainers");
    const [members] = await db.execute("SELECT * FROM members");
    const [attendance] = await db.execute("SELECT * FROM attendance");
    const [payments] = await db.execute("SELECT * FROM payments");
    ok(res, { exported_at: new Date().toISOString(), users, trainers, members, attendance, payments });
  });
}

