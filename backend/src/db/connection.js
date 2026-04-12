import mysql from "mysql2/promise";
import { config } from "../config.js";

let dbPool = null;

export async function openDb() {
  try {
    dbPool = mysql.createPool({
      host: config.db.host,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      port: config.db.port,
      waitForConnections: true,
      connectionLimit: 10,
      connectTimeout: 60000
    });

    // Test connection
    await dbPool.getConnection();
    console.log("✅ Database connected");

    return dbPool;
  } catch (err) {
    console.error("❌ DB CONNECTION ERROR:", err.message);
    return null; // VERY IMPORTANT: don't crash app
  }
}