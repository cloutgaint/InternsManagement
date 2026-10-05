import { createAuditLog } from "./audit.repository.js";

export async function audit(
  req,
  action,
  entityType,
  entityId,
  before = null,
  after = null,
) {
  await createAuditLog({
    actorId: req.user?.id || null,
    action,
    entityType,
    entityId: String(entityId || ""),
    before,
    after,
    ip: req.ip,
  });
}
