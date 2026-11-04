import { Router } from "express";
import { q } from "../common/database/index.js";
import { auth } from "../common/security/auth.middleware.js";

// Shared by every role; Sections 14-17 give Admin and Mentor notifications too.
const r = Router();
r.use(auth);
r.get("/", async (req, res) => {
  const rows = (await q("SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100", [req.user.id])).rows;
  res.json(rows);
});
r.get("/unread-count", async (req, res) => {
  res.json((await q("SELECT count(*)::int unread FROM notifications WHERE user_id=$1 AND read_at IS NULL", [req.user.id])).rows[0]);
});
r.post("/read-all", async (req, res) => {
  await q("UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE user_id=$1", [req.user.id]);
  res.json({ ok: true });
});
r.post("/:id/read", async (req, res) => {
  const x = (await q("UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2 RETURNING *", [req.params.id, req.user.id])).rows[0];
  if (!x) return res.status(404).json({ error: "Notification not found" });
  res.json(x);
});
export default r;
