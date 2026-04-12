import express from "express";
import { openDb } from "./db/connection.js";
async function startServer() {
  let db = null;

  try {
    console.time('Database Setup');
    console.log('🔄 Connecting to database...');
    
    db = await openDb();

    if (db) {
      console.log('✅ Database connected');

      console.log('🔄 Initializing database...');
      await initDb(db);
      console.log('✅ Database initialized');
    } else {
      console.log('⚠️ Database not connected, continuing without DB...');
    }

    console.timeEnd('Database Setup');

  } catch (err) {
    console.error('❌ Database setup failed:', err.message);
    console.log('⚠️ Continuing without database...');
  }

  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: "5mb" }));
  app.use(morgan("dev"));

  // Only use DB if available
  if (db) {
    const requireAuth = requireAuthFactory(db);
    registerRoutes(app, db, requireAuth);
  } else {
    app.get("/", (req, res) => {
      res.send("Server running (DB not connected)");
    });
  }

  // Serve frontend
  const frontendPath = path.resolve(__dirname, "..", "..", "frontend");
  app.use("/", express.static(frontendPath));

  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(frontendPath, "login.html"));
  });

  // 🚨 IMPORTANT FIX: use Railway port
  const PORT = process.env.PORT || config.port;

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

startServer();