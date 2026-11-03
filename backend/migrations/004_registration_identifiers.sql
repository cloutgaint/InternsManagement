-- Preserve deleted accounts and proof history while allowing legitimate re-registration.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_active_email ON users (lower(btrim(email))) WHERE status <> 'DELETED';
DROP INDEX IF EXISTS uq_proof_ref;
-- Roll-number uniqueness is checked transactionally in the registration service,
-- because a partial index on intern_profiles cannot reference users.status.
