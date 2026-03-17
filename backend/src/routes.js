import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { signToken, requireRole } from "./auth.js";
import {
  attendanceCreateSchema,
  loginSchema,
  memberRegisterSchema,
  memberCreateSchema,
  paymentCreateSchema,
  trainerCreateSchema,
  userUpsertSchema
} from "./validators.js";

function ok(res, data) {
  return res.json(data);
}

function badRequest(res, message, details) {
  return res.status(400).json({ error: message, details });
}

export function registerRoutes(app, db, requireAuth) {
  app.get("/api/health", (req, res) => ok(res, { ok: true }));

  app.post("/api/auth/login", (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());
    const user = db.prepare("SELECT * FROM users WHERE username=?").get(parsed.data.username);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const passOk = bcrypt.compareSync(parsed.data.password, user.password_hash);
    if (!passOk) return res.status(401).json({ error: "Invalid credentials" });
    const token = signToken(user);
    return ok(res, { token, user: { id: user.id, username: user.username, role: user.role } });
  });

  // Member portal auth (separate endpoint for clarity in UI)
  app.post("/api/member/register", (req, res) => {
    const parsed = memberRegisterSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());

    const exists = db.prepare("SELECT id FROM users WHERE username=?").get(parsed.data.username);
    if (exists) return res.status(409).json({ error: "Username already exists" });

    const memberId = nanoid();
    const join_date = new Date().toISOString().slice(0, 10);
    db.prepare(
      `
      INSERT INTO members
      (id, full_name, membership_type, join_date, status, assigned_trainer_id, phone, email, emergency_contact, notes)
      VALUES
      (@id, @full_name, @membership_type, @join_date, 'active', NULL, @phone, @email, NULL, NULL)
    `
    ).run({
      id: memberId,
      full_name: parsed.data.full_name,
      membership_type: parsed.data.membership_type,
      join_date,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null
    });

    const userId = nanoid();
    const passwordHash = bcrypt.hashSync(parsed.data.password, 10);
    db.prepare(
      "INSERT INTO users (id, username, password_hash, role, member_id) VALUES (?,?,?,?,?)"
    ).run(userId, parsed.data.username, passwordHash, "member", memberId);

    const user = { id: userId, username: parsed.data.username, role: "member" };
    const token = signToken(user);
    return ok(res, { token, user });
  });

  app.post("/api/member/login", (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());
    const user = db.prepare("SELECT * FROM users WHERE username=?").get(parsed.data.username);
    if (!user || user.role !== "member") return res.status(401).json({ error: "Invalid credentials" });
    const passOk = bcrypt.compareSync(parsed.data.password, user.password_hash);
    if (!passOk) return res.status(401).json({ error: "Invalid credentials" });
    const token = signToken(user);
    return ok(res, { token, user: { id: user.id, username: user.username, role: user.role } });
  });

  app.get("/api/me", requireAuth, (req, res) => ok(res, { user: req.user }));

  // Member portal API (requires member auth)
  app.get("/api/member/me", requireAuth, requireRole("member"), (req, res) => {
    const user = db.prepare("SELECT id, username, role, member_id FROM users WHERE id=?").get(req.user.id);
    const member = db
      .prepare(
        `
        SELECT m.*, t.full_name as trainer_name
        FROM members m
        LEFT JOIN trainers t ON t.id = m.assigned_trainer_id
        WHERE m.id=?
      `
      )
      .get(user.member_id);

    const open = db
      .prepare(
        `
        SELECT *
        FROM attendance
        WHERE member_id=? AND check_out_at IS NULL
        ORDER BY check_in_at DESC
        LIMIT 1
      `
      )
      .get(user.member_id);

    return ok(res, { user, member, openAttendance: open || null });
  });

  app.get("/api/member/trainers", requireAuth, requireRole("member"), (req, res) => {
    const trainers = db
      .prepare(
        `
        SELECT t.*,
          (SELECT COUNT(*) FROM members m WHERE m.assigned_trainer_id = t.id AND m.status='active') as assigned_members
        FROM trainers t
        WHERE t.status='active'
        ORDER BY t.full_name ASC
      `
      )
      .all();
    ok(res, { trainers });
  });

  app.post("/api/member/select-trainer", requireAuth, requireRole("member"), (req, res) => {
    const user = db.prepare("SELECT member_id FROM users WHERE id=?").get(req.user.id);
    const trainerId = req.body?.trainer_id || null;
    if (!trainerId) return badRequest(res, "trainer_id is required");
    const trainer = db.prepare("SELECT * FROM trainers WHERE id=? AND status='active'").get(trainerId);
    if (!trainer) return res.status(404).json({ error: "Trainer not found" });
    db.prepare("UPDATE members SET assigned_trainer_id=? WHERE id=?").run(trainerId, user.member_id);
    ok(res, { ok: true });
  });

  app.post("/api/member/check-in", requireAuth, requireRole("member"), (req, res) => {
    const user = db.prepare("SELECT member_id FROM users WHERE id=?").get(req.user.id);
    const open = db
      .prepare(
        "SELECT id FROM attendance WHERE member_id=? AND check_out_at IS NULL ORDER BY check_in_at DESC LIMIT 1"
      )
      .get(user.member_id);
    if (open) return res.status(409).json({ error: "Already checked in. Please check out first." });
    const id = nanoid();
    db.prepare("INSERT INTO attendance (id, member_id, check_in_at, check_out_at) VALUES (?,?,?,NULL)").run(
      id,
      user.member_id,
      new Date().toISOString()
    );
    ok(res, { id });
  });

  app.post("/api/member/check-out", requireAuth, requireRole("member"), (req, res) => {
    const user = db.prepare("SELECT member_id FROM users WHERE id=?").get(req.user.id);
    const open = db
      .prepare(
        "SELECT id FROM attendance WHERE member_id=? AND check_out_at IS NULL ORDER BY check_in_at DESC LIMIT 1"
      )
      .get(user.member_id);
    if (!open) return res.status(409).json({ error: "No active check-in found." });
    db.prepare("UPDATE attendance SET check_out_at=? WHERE id=?").run(new Date().toISOString(), open.id);
    ok(res, { ok: true });
  });

  app.get("/api/member/attendance", requireAuth, requireRole("member"), (req, res) => {
    const user = db.prepare("SELECT member_id FROM users WHERE id=?").get(req.user.id);
    const rows = db
      .prepare(
        `
        SELECT *
        FROM attendance
        WHERE member_id=?
        ORDER BY check_in_at DESC
        LIMIT 50
      `
      )
      .all(user.member_id);
    ok(res, { attendance: rows });
  });

  app.get("/api/dashboard/summary", requireAuth, (req, res) => {
    const members = db.prepare("SELECT COUNT(*) as c FROM members WHERE status='active'").get().c;
    const trainers = db.prepare("SELECT COUNT(*) as c FROM trainers WHERE status='active'").get().c;
    const classesToday = 5;
    const revenueRow = db
      .prepare(
        "SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE paid_at >= datetime('now','-30 days')"
      )
      .get();
    const revenue = revenueRow.total;

    const membershipRows = db
      .prepare("SELECT membership_type, COUNT(*) as c FROM members GROUP BY membership_type")
      .all();
    const membershipType = membershipRows.reduce(
      (acc, r) => ({ ...acc, [r.membership_type]: r.c }),
      { monthly: 0, annual: 0 }
    );

    const attendanceRows = db
      .prepare(
        `
        SELECT substr(check_in_at, 1, 10) as day, COUNT(*) as c
        FROM attendance
        WHERE check_in_at >= datetime('now','-6 days')
        GROUP BY substr(check_in_at, 1, 10)
        ORDER BY day ASC
      `
      )
      .all();

    const paymentRows = db
      .prepare(
        `
        SELECT substr(paid_at, 1, 10) as day, COALESCE(SUM(amount),0) as total
        FROM payments
        WHERE paid_at >= datetime('now','-6 days')
        GROUP BY substr(paid_at, 1, 10)
        ORDER BY day ASC
      `
      )
      .all();

    const recentActivities = [
      ...db
        .prepare(
          `
          SELECT 'attendance' as type, m.full_name as who, a.check_in_at as at
          FROM attendance a
          JOIN members m ON m.id = a.member_id
          ORDER BY a.check_in_at DESC
          LIMIT 3
        `
        )
        .all()
        .map((r) => ({ text: `Member ${r.who} checked in`, at: r.at })),
      ...db
        .prepare(
          `
          SELECT 'payment' as type, m.full_name as who, p.paid_at as at, p.amount as amount
          FROM payments p
          JOIN members m ON m.id = p.member_id
          ORDER BY p.paid_at DESC
          LIMIT 3
        `
        )
        .all()
        .map((r) => ({ text: `Payment received from ${r.who}`, at: r.at, amount: r.amount }))
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
  app.get("/api/members", requireAuth, (req, res) => {
    const rows = db
      .prepare(
        `
        SELECT m.*, t.full_name as trainer_name
        FROM members m
        LEFT JOIN trainers t ON t.id = m.assigned_trainer_id
        ORDER BY m.created_at DESC
      `
      )
      .all();
    ok(res, { members: rows });
  });

  app.post("/api/members", requireAuth, (req, res) => {
    const parsed = memberCreateSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());
    const id = nanoid();
    db.prepare(
      `
      INSERT INTO members
      (id, full_name, membership_type, join_date, status, assigned_trainer_id, phone, email, emergency_contact, notes)
      VALUES
      (@id, @full_name, @membership_type, @join_date, @status, @assigned_trainer_id, @phone, @email, @emergency_contact, @notes)
    `
    ).run({ id, ...parsed.data });
    ok(res, { id });
  });

  app.put("/api/members/:id", requireAuth, (req, res) => {
    const parsed = memberCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());
    const existing = db.prepare("SELECT * FROM members WHERE id=?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    const next = { ...existing, ...parsed.data };
    db.prepare(
      `
      UPDATE members SET
        full_name=@full_name,
        membership_type=@membership_type,
        join_date=@join_date,
        status=@status,
        assigned_trainer_id=@assigned_trainer_id,
        phone=@phone,
        email=@email,
        emergency_contact=@emergency_contact,
        notes=@notes
      WHERE id=@id
    `
    ).run(next);
    ok(res, { ok: true });
  });

  app.delete("/api/members/:id", requireAuth, (req, res) => {
    db.prepare("DELETE FROM members WHERE id=?").run(req.params.id);
    ok(res, { ok: true });
  });

  // Trainers
  app.get("/api/trainers", requireAuth, (req, res) => {
    const rows = db.prepare("SELECT * FROM trainers ORDER BY created_at DESC").all();
    ok(res, { trainers: rows });
  });

  app.post("/api/trainers", requireAuth, (req, res) => {
    const parsed = trainerCreateSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());
    const id = nanoid();
    db.prepare(
      "INSERT INTO trainers (id, full_name, specialty, phone, email, status) VALUES (@id,@full_name,@specialty,@phone,@email,@status)"
    ).run({ id, ...parsed.data });
    ok(res, { id });
  });

  app.put("/api/trainers/:id", requireAuth, (req, res) => {
    const parsed = trainerCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());
    const existing = db.prepare("SELECT * FROM trainers WHERE id=?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    const next = { ...existing, ...parsed.data };
    db.prepare(
      "UPDATE trainers SET full_name=@full_name, specialty=@specialty, phone=@phone, email=@email, status=@status WHERE id=@id"
    ).run(next);
    ok(res, { ok: true });
  });

  app.delete("/api/trainers/:id", requireAuth, (req, res) => {
    db.prepare("DELETE FROM trainers WHERE id=?").run(req.params.id);
    ok(res, { ok: true });
  });

  // Attendance
  app.get("/api/attendance", requireAuth, (req, res) => {
    const rows = db
      .prepare(
        `
        SELECT a.*, m.full_name as member_name
        FROM attendance a
        JOIN members m ON m.id = a.member_id
        ORDER BY a.check_in_at DESC
        LIMIT 200
      `
      )
      .all();
    ok(res, { attendance: rows });
  });

  app.post("/api/attendance", requireAuth, (req, res) => {
    const parsed = attendanceCreateSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());
    const id = nanoid();
    const check_in_at = parsed.data.check_in_at || new Date().toISOString();
    db.prepare("INSERT INTO attendance (id, member_id, check_in_at, check_out_at) VALUES (?,?,?,NULL)").run(
      id,
      parsed.data.member_id,
      check_in_at
    );
    ok(res, { id });
  });

  // Payments
  app.get("/api/payments", requireAuth, (req, res) => {
    const rows = db
      .prepare(
        `
        SELECT p.*, m.full_name as member_name
        FROM payments p
        JOIN members m ON m.id = p.member_id
        ORDER BY p.paid_at DESC
        LIMIT 200
      `
      )
      .all();
    ok(res, { payments: rows });
  });

  app.post("/api/payments", requireAuth, (req, res) => {
    const parsed = paymentCreateSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());
    const id = nanoid();
    const paid_at = parsed.data.paid_at || new Date().toISOString();
    db.prepare("INSERT INTO payments (id, member_id, amount, method, paid_at) VALUES (?,?,?,?,?)").run(
      id,
      parsed.data.member_id,
      parsed.data.amount,
      parsed.data.method,
      paid_at
    );
    ok(res, { id });
  });

  // Reports
  app.get("/api/reports/overview", requireAuth, (req, res) => {
    const topMembers = db
      .prepare(
        `
        SELECT m.full_name, COUNT(a.id) as checkins
        FROM members m
        LEFT JOIN attendance a ON a.member_id = m.id AND a.check_in_at >= datetime('now','-30 days')
        GROUP BY m.id
        ORDER BY checkins DESC
        LIMIT 5
      `
      )
      .all();
    const paymentByMethod = db
      .prepare(
        `
        SELECT method, COALESCE(SUM(amount),0) as total
        FROM payments
        WHERE paid_at >= datetime('now','-30 days')
        GROUP BY method
      `
      )
      .all();
    ok(res, { topMembers, paymentByMethod });
  });

  // Settings / Admin actions
  app.get("/api/admin/users", requireAuth, requireRole("admin"), (req, res) => {
    const users = db.prepare("SELECT id, username, role, created_at FROM users ORDER BY created_at DESC").all();
    ok(res, { users });
  });

  app.post("/api/admin/users", requireAuth, requireRole("admin"), (req, res) => {
    const parsed = userUpsertSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());
    const existing = db.prepare("SELECT * FROM users WHERE username=?").get(parsed.data.username);
    if (existing) return res.status(409).json({ error: "Username already exists" });
    const id = nanoid();
    const passwordHash = bcrypt.hashSync(parsed.data.password || "changeme123", 10);
    db.prepare("INSERT INTO users (id, username, password_hash, role) VALUES (?,?,?,?)").run(
      id,
      parsed.data.username,
      passwordHash,
      parsed.data.role
    );
    ok(res, { id });
  });

  app.put("/api/admin/users/:id", requireAuth, requireRole("admin"), (req, res) => {
    const parsed = userUpsertSchema.partial().safeParse(req.body);
    if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());
    const existing = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    const next = { ...existing, ...parsed.data };
    if (parsed.data.password) next.password_hash = bcrypt.hashSync(parsed.data.password, 10);
    db.prepare("UPDATE users SET username=@username, password_hash=@password_hash, role=@role WHERE id=@id").run(next);
    ok(res, { ok: true });
  });

  app.delete("/api/admin/users/:id", requireAuth, requireRole("admin"), (req, res) => {
    db.prepare("DELETE FROM users WHERE id=?").run(req.params.id);
    ok(res, { ok: true });
  });

  app.post("/api/admin/reset-all-passwords", requireAuth, requireRole("admin"), (req, res) => {
    const users = db.prepare("SELECT id FROM users").all();
    const setPass = db.prepare("UPDATE users SET password_hash=? WHERE id=?");
    const insertReset = db.prepare("INSERT INTO password_resets (id, user_id) VALUES (?,?)");
    const tx = db.transaction(() => {
      for (const u of users) {
        const hash = bcrypt.hashSync("admin123", 10);
        setPass.run(hash, u.id);
        insertReset.run(nanoid(), u.id);
      }
    });
    tx();
    ok(res, { ok: true, newPassword: "admin123" });
  });

  app.get("/api/admin/backup", requireAuth, requireRole("admin"), (req, res) => {
    const users = db.prepare("SELECT id, username, role, created_at FROM users").all();
    const trainers = db.prepare("SELECT * FROM trainers").all();
    const members = db.prepare("SELECT * FROM members").all();
    const attendance = db.prepare("SELECT * FROM attendance").all();
    const payments = db.prepare("SELECT * FROM payments").all();
    ok(res, { exported_at: new Date().toISOString(), users, trainers, members, attendance, payments });
  });
}

