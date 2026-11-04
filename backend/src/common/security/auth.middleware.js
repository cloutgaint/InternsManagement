import jwt from "jsonwebtoken";
import { q } from "../database/index.js";

// Disabling, deleting or re-credentialing an account must end existing sessions, not wait for expiry.
export async function auth(req, res, next) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;

  if (!token)
    return res.status(401).json({ error: "Authentication required" });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  try {
    const user = (await q("SELECT role,status,is_active,password_changed_at FROM users WHERE id=$1", [payload.id])).rows[0];
    if (!user || !user.is_active || user.status === "DELETED")
      return res.status(401).json({ error: "This account is no longer active" });
    if (user.password_changed_at && payload.iat && payload.iat * 1000 < new Date(user.password_changed_at).getTime() - 1000)
      return res.status(401).json({ error: "Password changed. Sign in again." });
    req.user = { ...payload, role: user.role };
    next();
  } catch (error) {
    next(error);
  }
}

export const permit =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user.role)
      ? next()
      : res.status(403).json({ error: "Forbidden" });
