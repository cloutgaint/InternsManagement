import { q } from "../database/index.js";

export async function createAuditLog({
  actorId,
  action,
  entityType,
  entityId,
  before,
  after,
  ip,
}) {
  await q(
    "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,before_data,after_data,ip) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [actorId, action, entityType, entityId, before, after, ip],
  );
}
