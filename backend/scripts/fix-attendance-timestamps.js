import mysql from "mysql2/promise";
import { config } from "../src/config.js";

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((arg) => arg.startsWith("--") && !arg.includes("=")));
  const named = args
    .filter((arg) => arg.includes("="))
    .reduce((acc, arg) => {
      const [key, value] = arg.split("=");
      acc[key] = value;
      return acc;
    }, {});

  return {
    force: flags.has("--force") || flags.has("-f"),
    preview: flags.has("--preview") || !flags.has("--force"),
    offsetMinutes: named["--offset"] ? Number(named["--offset"]) : -new Date().getTimezoneOffset(),
    before: named["--before"] || null
  };
}

function formatMysqlDate(value) {
  if (!value) return "-";
  const parsed = new Date(value.toString().replace(" ", "T"));
  return parsed.toLocaleString(undefined, { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit", year: "numeric", month: "numeric", day: "numeric" });
}

async function run() {
  const options = parseArgs();

  console.log("Attendance timestamp fixer");
  console.log(`Offset minutes: ${options.offsetMinutes}`);
  if (options.before) console.log(`Targeting rows before: ${options.before}`);

  const db = await mysql.createPool(config.db);

  const filter = options.before ? "WHERE check_in_at < ?" : "";
  const params = options.before ? [options.before] : [];
  const [rows] = await db.execute(
    `SELECT id, member_id, check_in_at, check_out_at FROM attendance ${filter} ORDER BY id DESC LIMIT 20`,
    params
  );

  console.log(`Showing up to 20 recent attendance rows${options.before ? ` before ${options.before}` : ""}:`);
  for (const row of rows) {
    const correctedCheckIn = row.check_in_at ? formatMysqlDate(new Date(new Date(row.check_in_at.toString().replace(" ", "T")).getTime() + options.offsetMinutes * 60000)) : "-";
    const correctedCheckOut = row.check_out_at ? formatMysqlDate(new Date(new Date(row.check_out_at.toString().replace(" ", "T")).getTime() + options.offsetMinutes * 60000)) : "-";
    console.log(`- id=${row.id}, member_id=${row.member_id}`);
    console.log(`    check_in_at : ${row.check_in_at} -> ${correctedCheckIn}`);
    console.log(`    check_out_at: ${row.check_out_at || "-"} -> ${correctedCheckOut}`);
  }

  if (!options.force) {
    console.log("\nPreview mode only. Add --force to apply the correction.");
    await db.end();
    return;
  }

  console.log("\nApplying timestamp correction...");
  const updateFilter = options.before ? "WHERE check_in_at < ?" : "";
  const updateParams = options.before ? [options.offsetMinutes, options.offsetMinutes, options.before] : [options.offsetMinutes, options.offsetMinutes];
  await db.execute(
    `UPDATE attendance SET check_in_at = DATE_ADD(check_in_at, INTERVAL ? MINUTE) ${updateFilter}`,
    options.before ? [options.offsetMinutes, options.before] : [options.offsetMinutes]
  );
  await db.execute(
    `UPDATE attendance SET check_out_at = DATE_ADD(check_out_at, INTERVAL ? MINUTE) ${updateFilter}`,
    options.before ? [options.offsetMinutes, options.before] : [options.offsetMinutes]
  );

  console.log("Correction applied.");
  await db.end();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
