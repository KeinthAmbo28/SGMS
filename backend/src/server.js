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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = openDb();
initDb(db);

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

const requireAuth = requireAuthFactory(db);
registerRoutes(app, db, requireAuth);

// Serve the new UI
const frontendPath = path.resolve(__dirname, "..", "..", "frontend");
app.use("/", express.static(frontendPath));

// SPA-ish fallback: route unknown paths to login
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(frontendPath, "login.html"));
});

app.listen(config.port, () => {
  console.log(`SmartGym running on http://localhost:${config.port}`);
  console.log(`Login: admin / admin123`);
});

