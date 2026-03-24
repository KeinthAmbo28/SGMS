import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 5050),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  // SQLite config (commented out)
  // dbPath:
  //   process.env.DB_PATH ||
  //   fileURLToPath(new URL("./db/smartgym.sqlite", import.meta.url)),
  // MySQL config
  db: {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "smartgym",
    port: Number(process.env.DB_PORT) || 3306
  }
};

