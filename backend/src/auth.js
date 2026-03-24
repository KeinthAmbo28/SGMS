import jwt from "jsonwebtoken";
import { config } from "./config.js";

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: "8h" }
  );
}

export function requireAuth(db) {
  return async (req, res, next) => {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      const [userRows] = await db.execute("SELECT id, username, role, status FROM users WHERE id=?", [payload.sub]);
      const user = userRows[0];
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      if (user.status === "frozen") return res.status(403).json({ error: "Account frozen" });
      await db.execute("UPDATE users SET last_active_at=NOW() WHERE id=?", [user.id]);
      req.user = user;
      next();
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
  };
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

