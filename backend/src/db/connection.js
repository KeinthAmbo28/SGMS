import mysql from "mysql2/promise";

let dbPool = null;

export async function openDb() {
  if (!dbPool) {
    dbPool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }
  return dbPool;
}

export async function closeDb() {
  if (dbPool) {
    await dbPool.end();
    dbPool = null;
  }
}