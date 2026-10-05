import {
  createNotification,
  findActiveGroupUserIds,
} from "./notification.repository.js";

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
