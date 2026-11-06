// An intern belongs to one group. Membership of an approved group blocks the move; a leftover
// draft proposal gives way. Call inside the transaction that adds the interns to groupId.
export async function claimInternsForGroup(client, internIds, groupId) {
  const taken = (await client.query(
    "SELECT DISTINCT g.name FROM group_members gm JOIN groups g ON g.id=gm.group_id WHERE gm.intern_id=ANY($1::uuid[]) AND gm.active AND g.id IS DISTINCT FROM $2::uuid AND g.status='ACTIVE'",
    [internIds, groupId],
  )).rows;
  if (taken.length) {
    throw Object.assign(new Error("An intern can only be in one group. Already assigned to: " + taken.map((x) => x.name).join(", ")), { status: 409 });
  }
  await client.query("UPDATE group_members SET active=false WHERE intern_id=ANY($1::uuid[]) AND active AND group_id IS DISTINCT FROM $2::uuid", [internIds, groupId]);
}
