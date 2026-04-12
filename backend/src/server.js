import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "./config.js";
import { openDb } from "./db/connection.js";
import { initDb } from "./db/init.js";
import { requireAuth as requireAuthFactory } from "./auth.js";
import { registerRoutes } from "./routes.js";
import { runAccountFreeze } from "./accountFreeze.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.time('Database Setup');
  console.log('🔄 Connecting to database...');
  const db = await openDb();
  console.log('✅ Database connected');

  console.log('🔄 Initializing database...');
  await initDb(db);
  console.time('Database Setup');

let db = null;

try {
  console.log('🔄 Connecting to database...');
  db = await openDb();

  console.log('🔄 Initializing database...');
  await initDb(db);

  console.log('✅ Database initialized');
} catch (err) {
  console.error('❌ Database failed:', err.message);
}

console.timeEnd('Database Setup');

  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: "5mb" }));
  app.use(morgan("dev"));

  const requireAuth = requireAuthFactory(db);
  registerRoutes(app, db, requireAuth);

  if (db) {
  const requireAuth = requireAuthFactory(db);
  registerRoutes(app, db, requireAuth);
} else {
  console.warn("⚠️ Running without database");
}

  // Background auto-freeze runner (optional; controlled by `account_freeze_settings.enabled`)
  setInterval(() => {
    try {
      runAccountFreeze(db);
    } catch (e) {
      console.error("Auto-freeze runner failed:", e?.message || e);
    }
  }, 6 * 60 * 60 * 1000); // every 6 hours

  // Serve the new UI
  const frontendPath = path.resolve(__dirname, "..", "..", "frontend");
  app.use("/", express.static(frontendPath));

  // SPA-ish fallback: route unknown paths to login
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(frontendPath, "login.html"));
  });

  app.listen(process.env.PORT || config.port, () => {
    console.log(`SmartGym running on http://localhost:${config.port}`);
    console.log(`Login: admin / admin123`);
  });
}

startServer().catch(console.error);