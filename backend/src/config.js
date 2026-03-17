import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 5050),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  dbPath:
    process.env.DB_PATH ||
    fileURLToPath(new URL("./db/smartgym.sqlite", import.meta.url))
};

