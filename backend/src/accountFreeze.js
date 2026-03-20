export function getAccountFreezeSettings(db) {
  const row = db.prepare("SELECT * FROM account_freeze_settings WHERE id=1").get();
  return {
    enabled: !!row?.enabled,
    inactive_days: Number(row?.inactive_days ?? 30),
    include_never_used: !!row?.include_never_used,
    last_run_at: row?.last_run_at ?? null
  };
}

export function updateAccountFreezeSettings(db, next) {
  db.prepare(
    `
    UPDATE account_freeze_settings
    SET enabled=@enabled,
        inactive_days=@inactive_days,
        include_never_used=@include_never_used,
        updated_at=datetime('now')
    WHERE id=1
  `
  ).run({
    enabled: next.enabled ? 1 : 0,
    inactive_days: next.inactive_days,
    include_never_used: next.include_never_used ? 1 : 0
  });
}

export function runAccountFreeze(db, { force = false } = {}) {
  const settings = getAccountFreezeSettings(db);
  if (!settings.enabled && !force) return { frozenCount: 0, ran: false };

  const inactiveDays = Math.max(0, Number(settings.inactive_days) || 0);
  if (inactiveDays <= 0) return { frozenCount: 0, ran: false };

  const modifier = `-${inactiveDays} days`;

  const whereClause = settings.include_never_used
    ? "(last_active_at IS NULL OR last_active_at <= datetime('now', ?))"
    : "(last_active_at IS NOT NULL AND last_active_at <= datetime('now', ?))";

  const stmt = `
    UPDATE users
    SET status='frozen',
        frozen_at=datetime('now')
    WHERE status='active'
      AND role!='admin'
      AND ${whereClause}
  `;

  const info = db.prepare(stmt).run(modifier);
  db.prepare("UPDATE account_freeze_settings SET last_run_at=datetime('now'), updated_at=datetime('now') WHERE id=1").run();

  return { frozenCount: info.changes, ran: true };
}

