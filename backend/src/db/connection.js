import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

export function openDb() {
  const dir = path.dirname(config.dbPath);
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(config.dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

