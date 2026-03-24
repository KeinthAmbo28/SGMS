import mysql from "mysql2/promise";
import { config } from "../config.js";

let dbPool = null;

export async function openDb() {
  if (!dbPool) {
    // First connect without database to create it if needed
    const tempConfig = { ...config.db };
    delete tempConfig.database;
    delete tempConfig.connectionLimit; // Remove pool-specific config for temp connection
    const tempConnection = await mysql.createConnection(tempConfig);

    // Check if database exists, create it only if it doesn't exist
    const [rows] = await tempConnection.execute(`SHOW DATABASES LIKE '${config.db.database}'`);
    if (rows.length === 0) {
      // Database doesn't exist, create it
      await tempConnection.execute(`CREATE DATABASE ${config.db.database}`);
    }
    await tempConnection.end();

    // Now create a connection pool for better performance
    dbPool = mysql.createPool(config.db);
  }
  return dbPool;
}

export async function closeDb() {
  if (dbPool) {
    await dbPool.end();
    dbPool = null;
  }
}

