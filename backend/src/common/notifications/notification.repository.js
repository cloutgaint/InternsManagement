import { q } from "../database/index.js";

export async function createNotification({
  userId,
  type,
  title,
  body,
  actionUrl,
  eventKey,
}) {
  await q(
    "INSERT INTO notifications(user_id,type,title,body,action_url,event_key) VALUES($1,$2,$3,$4,$5,$6)",
    [userId, type, title, body, actionUrl, eventKey],
  );
}

export async function findActiveGroupUserIds(groupId) {
  return (
    await q(
      `SELECT DISTINCT ip.user_id
       FROM group_members gm
       JOIN intern_profiles ip ON ip.id=gm.intern_id
       WHERE gm.group_id=$1 AND gm.active
       UNION
       SELECT DISTINCT m.user_id
       FROM mentor_assignments ma
       JOIN mentors m ON m.id=ma.mentor_id
       WHERE ma.group_id=$1 AND ma.active`,
      [groupId],
    )
  ).rows;
}
