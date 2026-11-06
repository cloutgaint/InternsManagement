-- Rule: an intern belongs to one batch and one active group.
-- Remove a duplicate allocation only when nothing depends on it and the intern's active group is in their other batch.
-- Any other duplicate makes the index below fail, so it must be resolved by hand rather than guessed.
DELETE FROM batch_allocations ba
WHERE EXISTS (
    SELECT 1 FROM batch_allocations other
    JOIN group_members gm ON gm.intern_id=other.intern_id AND gm.active
    JOIN groups g ON g.id=gm.group_id AND g.batch_id=other.batch_id
    WHERE other.intern_id=ba.intern_id AND other.id<>ba.id
  )
  AND NOT EXISTS (SELECT 1 FROM group_members gm JOIN groups g ON g.id=gm.group_id WHERE gm.intern_id=ba.intern_id AND gm.active AND g.batch_id=ba.batch_id)
  AND NOT EXISTS (SELECT 1 FROM offer_letters ol WHERE ol.allocation_id=ba.id)
  AND NOT EXISTS (SELECT 1 FROM allotment_verifications av WHERE av.allocation_id=ba.id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_batch_allocation_one_per_intern ON batch_allocations(intern_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_group_member_one_active_per_intern ON group_members(intern_id) WHERE active;
