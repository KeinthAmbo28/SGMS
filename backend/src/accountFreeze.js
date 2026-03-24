export async function getAccountFreezeSettings(db) {
  const [rows] = await db.execute("SELECT * FROM account_freeze_settings WHERE id=1");
  const row = rows[0];
  return {
    enabled: !!row?.enabled,
    inactive_days: Number(row?.inactive_days ?? 30),
    include_never_used: !!row?.include_never_used,
    last_run_at: row?.last_run_at ?? null
  };
}

export async function updateAccountFreezeSettings(db, next) {
  await db.execute(
    `
    UPDATE account_freeze_settings
    SET enabled=?,
        inactive_days=?,
        include_never_used=?,
        updated_at=NOW()
    WHERE id=1
  `,
    [next.enabled ? 1 : 0, next.inactive_days, next.include_never_used ? 1 : 0]
  );
}

export async function runAccountFreeze(db, { force = false } = {}) {
  const settings = await getAccountFreezeSettings(db);
  if (!settings.enabled && !force) return { frozenCount: 0, ran: false };

  const inactiveDays = Math.max(0, Number(settings.inactive_days) || 0);
  if (inactiveDays <= 0) return { frozenCount: 0, ran: false };

  const whereClause = settings.include_never_used
    ? "(last_active_at IS NULL OR last_active_at <= DATE_SUB(NOW(), INTERVAL ? DAY))"
    : "(last_active_at IS NOT NULL AND last_active_at <= DATE_SUB(NOW(), INTERVAL ? DAY))";

  const stmt = `
    UPDATE users
    SET status='frozen',
        frozen_at=NOW()
    WHERE status='active'
      AND role!='admin'
      AND ${whereClause}
  `;

  const [result] = await db.execute(stmt, [inactiveDays]);
  await db.execute("UPDATE account_freeze_settings SET last_run_at=NOW(), updated_at=NOW() WHERE id=1");

  return { frozenCount: result.affectedRows, ran: true };
}

