import {
  createNotification,
  findActiveGroupUserIds,
} from "./notification.repository.js";
import { q } from "../database/index.js";
import { sendMail } from "./mail.service.js";

export async function notify(
  userId,
  type,
  title,
  body,
  actionUrl = null,
  eventKey = null,
) {
  if (!userId) return;
  await createNotification({
    userId,
    type,
    title,
    body,
    actionUrl,
    eventKey,
  });
}

// Applicants without login access only see decisions by email.
export async function notifyWithEmail(userId, type, title, body, actionUrl = null) {
  await notify(userId, type, title, body, actionUrl);
  const user = (await q("SELECT email FROM users WHERE id=$1", [userId])).rows[0];
  await sendMail({ to: user?.email, subject: "GAINT Internship: " + title, text: body });
}

export async function notifyAdmins(type, title, body, actionUrl = null, eventKey = null) {
  const admins = (await q("SELECT id FROM users WHERE role IN ('ADMIN','SUPER_ADMIN') AND is_active AND status<>'DELETED'")).rows;
  for (const admin of admins) await notify(admin.id, type, title, body, actionUrl, eventKey);
}

export async function notifyGroup(
  groupId,
  type,
  title,
  body,
  actionUrl = null,
  eventKey = null,
  excludeUserId = null,
) {
  const users = await findActiveGroupUserIds(groupId);
  for (const { user_id: userId } of users) {
    if (userId !== excludeUserId)
      await notify(userId, type, title, body, actionUrl, eventKey);
  }
}
