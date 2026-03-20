import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";

import { schemaSql } from "../src/db/schema.js";
import { runAccountFreeze } from "../src/accountFreeze.js";

function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys=ON");
  db.exec(schemaSql);

  // Single-row settings table expected by accountFreeze.js
  db.prepare("INSERT INTO account_freeze_settings (id) VALUES (1)").run();

  return db;
}

function setFreezeSettings(db, { enabled, inactive_days, include_never_used }) {
  db.prepare(
    `
    UPDATE account_freeze_settings
    SET enabled=@enabled,
        inactive_days=@inactive_days,
        include_never_used=@include_never_used
  `
  ).run({
    enabled: enabled ? 1 : 0,
    inactive_days,
    include_never_used: include_never_used ? 1 : 0
  });
}

function insertUser(db, user) {
  db.exec(
    `
    INSERT INTO users (id, username, password_hash, role, status, last_active_at, frozen_at)
    VALUES (
      '${user.id}',
      '${user.username}',
      '${user.password_hash}',
      '${user.role}',
      '${user.status}',
      ${user.last_active_at_sql},
      ${user.frozen_at_sql}
    );
  `
  );
}

function getUser(db, id) {
  return db.prepare("SELECT id, role, status, last_active_at, frozen_at FROM users WHERE id=?").get(id);
}

test("freezes inactive accounts when enabled", async () => {
  const db = createTestDb();

  setFreezeSettings(db, { enabled: true, inactive_days: 30, include_never_used: false });

  // last active 31 days ago -> should freeze
  insertUser(db, {
    id: "u1",
    username: "t1",
    password_hash: "x",
    role: "trainer",
    status: "active",
    last_active_at_sql: "datetime('now','-31 days')",
    frozen_at_sql: "NULL"
  });

  const res = runAccountFreeze(db);
  assert.equal(res.frozenCount, 1);

  const u = getUser(db, "u1");
  assert.equal(u.status, "frozen");
  assert.ok(u.frozen_at, "frozen_at should be set");
});

test("does not freeze never-used accounts unless include_never_used=true", async () => {
  const db = createTestDb();

  setFreezeSettings(db, { enabled: true, inactive_days: 30, include_never_used: false });

  // never used -> last_active_at NULL
  insertUser(db, {
    id: "u2",
    username: "t2",
    password_hash: "x",
    role: "trainer",
    status: "active",
    last_active_at_sql: "NULL",
    frozen_at_sql: "NULL"
  });

  const res = runAccountFreeze(db);
  assert.equal(res.frozenCount, 0);

  const u = getUser(db, "u2");
  assert.equal(u.status, "active");
});

test("freezes never-used accounts when include_never_used=true", async () => {
  const db = createTestDb();

  setFreezeSettings(db, { enabled: true, inactive_days: 30, include_never_used: true });

  insertUser(db, {
    id: "u3",
    username: "t3",
    password_hash: "x",
    role: "trainer",
    status: "active",
    last_active_at_sql: "NULL",
    frozen_at_sql: "NULL"
  });

  const res = runAccountFreeze(db);
  assert.equal(res.frozenCount, 1);

  const u = getUser(db, "u3");
  assert.equal(u.status, "frozen");
  assert.ok(u.frozen_at, "frozen_at should be set");
});

test("does not freeze admin users", async () => {
  const db = createTestDb();

  setFreezeSettings(db, { enabled: true, inactive_days: 30, include_never_used: true });

  insertUser(db, {
    id: "admin1",
    username: "admin1",
    password_hash: "x",
    role: "admin",
    status: "active",
    last_active_at_sql: "datetime('now','-120 days')",
    frozen_at_sql: "NULL"
  });

  const res = runAccountFreeze(db);
  assert.equal(res.frozenCount, 0);

  const u = getUser(db, "admin1");
  assert.equal(u.status, "active");
});