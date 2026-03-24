import mysql from "mysql2/promise";
import { config } from "../config.js";

let dbConnection = null;

export async function openDb() {
  if (!dbConnection) {
    // First connect without database to create it if needed
    const tempConfig = { ...config.db };
    delete tempConfig.database;
    const tempConnection = await mysql.createConnection(tempConfig);
    await tempConnection.execute(`DROP DATABASE IF EXISTS ${config.db.database}`);
    await tempConnection.execute(`CREATE DATABASE ${config.db.database}`);
    await tempConnection.end();

    // Now connect to the database
    dbConnection = await mysql.createConnection(config.db);
  }
  return dbConnection;
}

export async function closeDb() {
  if (dbConnection) {
    await dbConnection.end();
    dbConnection = null;
  }
}

