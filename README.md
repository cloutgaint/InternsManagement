# GAINT Intern Management App — v1.2 implementation

Production-oriented monorepo generated from the **GAINT Intern Management App Master Product & Functional Blueprint v1.2 (September 2026)**.

## Architecture

- **Frontend:** Next.js + React + JavaScript, responsive role dashboards. Thin
  `frontend/pages/` route files render screens from compact feature folders in
  `frontend/modules/`; see [frontend structure](frontend/README.md).
- **Backend:** Node.js + Express REST API, modular route/middleware structure.
- **Database:** PostgreSQL 16; plain SQL migration so it is fully visible/manageable in pgAdmin.
- **Auth:** hybrid HS256 + ML-DSA-65 tokens, Argon2id password hashing with legacy bcrypt migration, approved-account login gate, and RBAC for Super Admin/Admin/Mentor/Intern.
- **Audit/security:** Helmet, CORS, rate limiting, validation, audit records, restricted proof/biometric data model.

## Development order used

1. PostgreSQL schema and relationships
2. Express backend and workflow APIs
3. JWT authentication + RBAC
4. Next.js frontend shell and registration/login
5. Admin/Mentor/Intern dashboards
6. Workflow integrations (proof → approval → batch → offer → domain → group → face → attendance → tasks/reviews → completion data model)
7. Validation/security/error handling
8. Smoke tests/build verification
9. Production containerization

## Local setup

### Docker (recommended)

```bash
cp .env.example .env
docker compose up --build
```

Open frontend at `http://localhost:3000`, API at `http://localhost:8000/api/health`, and connect pgAdmin to PostgreSQL on host port **5434** (`postgres` / `postgres`, DB `gaint_interns`). The health endpoint returns `503` unless the API can query PostgreSQL.

Development seed Super Admin: `admin@gaintclout.com` / `ChangeMe123!`. **Change this immediately.** Production refuses this default; set `INITIAL_ADMIN_EMAIL` and a unique `INITIAL_ADMIN_PASSWORD` before deployment.

### Without Docker

```bash
# PostgreSQL: create database gaint_interns and set DATABASE_URL
cd backend
npm install
npm run migrate
npm run seed
npm run dev

# second terminal
cd frontend
npm install
npm run dev
```

## Main API structure

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `/api/admin/*`: dashboard, proof queue/decisions, intern approval, colleges, domains, batches, allocation, offer letters, face decisions, domain confirmation, group approval, attendance exception decisions, audit
- `/api/intern/*`: dashboard, proof submission, face enrollment, attendance events, daily reports, leave, weekly task submission
- `/api/mentor/*`: dashboard, task evaluation, fortnight reviews

## Database

The migration creates the full lifecycle model: users/roles, intern profiles, colleges/coordinators, proofs/verifications, batch allotment and allocations, offer letters/versioning, domains/subdomains/rubrics, assessments/answers, domain decisions, groups/members, mentors/assignments, projects, face enrollment, attendance/exceptions, holidays/leave, daily reports, weekly tasks/evaluations, fortnight reviews/individual marks, documents/chat/notifications, final evaluations/completion/exits, certificates/college reports, and audit logs.

## Important blueprint-configurable items

The source document itself leaves several items to decide before final development, especially the selected **face matching/liveness technology and devices**, biometric retry/fallback/retention policy, exact domain/rubric weights, completion authority, certificate template/mode, offer-letter template/signatory/numbering, retention policies, and optional AI provider. These are not safely inventable. The application includes the workflow/data contracts around them; production activation requires GAINT to set those choices.

See `REQUIREMENTS_CHECKLIST.md` for traceability.

## Production deployment

The production stack is `docker-compose.prod.yml`. It runs PostgreSQL, the API, the frontend, the face
verifier and a ClamAV virus scanner on a private network, behind Caddy, which serves one HTTPS domain
(`https://APP_DOMAIN`, with the API at `/api`) and renews its certificate automatically. Only ports 80
and 443 are published. The development `docker-compose.yml` is unchanged.

You provide:

- a server with Docker, and a domain whose DNS points at it (ports 80 and 443 open);
- a private S3-compatible bucket and access key (AWS S3, Cloudflare R2, …);
- an SMTP account for outgoing email.

```bash
cp deploy/production.env.example .env.production   # git ignores it
# fill in every empty value; the file explains how to generate each secret
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Compose refuses to start while a required value is empty, and the API refuses to start in production
when any security control is missing or insecure. The first start takes a few minutes while ClamAV
downloads its virus signatures. The API runs migrations and creates the first Super Admin from
`INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` on start.

**Test-server sign-in:** `ALLOW_TEST_MFA_CODE=true` (the template default) lets staff accounts use the
code `000000` instead of an authenticator app, and the API logs a warning on every start while it is
on. Anyone with a staff password can then sign in, so set it to `false` and restart before real users
are onboarded. Authenticator-app codes work either way.

**Face attendance:** the verifier compares faces and records an anti-spoof score for every attempt,
but does not reject on that score until `BIOMETRIC_ANTISPOOF_THRESHOLD` is set; see
`biometric-verifier/README.md`.

Keep the bucket's public access blocked, back up the `pgdata` volume and the bucket, and never change
or lose `FILE_ENCRYPTION_KEY`: files encrypted with it cannot be read without it.

### Cryptographic rotation

- New and changed passwords use Argon2id. Existing bcrypt passwords remain valid and are transparently upgraded after a successful credential check.
- The classical half of authentication tokens is explicitly restricted to HS256. During a signing-secret rotation, place old secrets in `JWT_PREVIOUS_SECRETS` until their maximum token lifetime has elapsed.
- New authentication tokens are hybrid-signed with HS256 and NIST ML-DSA-65. Set `PQ_REQUIRE_HYBRID_TOKENS=true` in production after any pre-upgrade sessions have expired.
- New protected files use the versioned `GAINTENC3` ML-KEM-768 + AES-256-GCM envelope. ML-KEM establishes a fresh content key per file; AES-GCM encrypts and authenticates the file bytes. `GAINTENC1/2` files remain readable. Set `FILE_ENCRYPTION_KEY_ID` whenever the current key changes and retain old id/key pairs in `FILE_ENCRYPTION_PREVIOUS_KEYS` until older files have been re-encrypted or expired.
- PQC or hybrid TLS must be configured at the ingress/load-balancer and for upstream services; it is not enabled by application code or by changing these environment variables.

After backing up storage, upgrade files already referenced by the database from
the legacy envelopes to `GAINTENC3`:

```bash
cd backend
npm run migrate:post-quantum-files:dry-run
npm run migrate:post-quantum-files
```

Run the full test suite against a disposable database whose name contains `intern_test`:

```bash
cd backend
RUN_DB_E2E=1 DATABASE_URL=postgresql://.../intern_test npm test

cd ../frontend
npm test
```
