# GAINT Intern Management App — v1.2 implementation

Production-oriented monorepo generated from the **GAINT Intern Management App Master Product & Functional Blueprint v1.2 (September 2026)**.

## Architecture

- **Frontend:** Next.js + React + JavaScript, responsive role dashboards. Thin
  `frontend/pages/` route files render screens from compact feature folders in
  `frontend/modules/`; see [frontend structure](frontend/README.md).
- **Backend:** Node.js + Express REST API, modular route/middleware structure.
- **Database:** PostgreSQL 16; plain SQL migration so it is fully visible/manageable in pgAdmin.
- **Auth:** JWT, bcrypt password hashing, approved-account login gate, RBAC for Super Admin/Admin/Mentor/Intern.
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

## Production settings

Before going live, set `NODE_ENV=production`, `NEXT_PUBLIC_API_URL` to the public HTTPS API URL, and configure every production requirement documented in `.env.example`: unique initial-admin credentials, a 64-byte `JWT_SECRET`, `FILE_ENCRYPTION_KEY`, private S3 object storage, `SMTP_*`, `CLAMAV_HOST`, an approved HTTPS biometric verifier, and proof/face retention periods. Set `BACKEND_DATABASE_URL` when Docker should use a managed database instead of its bundled PostgreSQL service. Use a workload role/identity for S3 rather than long-lived access keys, keep the bucket public-access blocked, and apply lifecycle/backup policies appropriate to the retention requirements. The API refuses to start in production when any of these controls are absent or insecure. Because `NEXT_PUBLIC_API_URL` is compiled into the browser bundle, set it before building the frontend image.

Run the full test suite against a disposable database whose name contains `intern_test`:

```bash
cd backend
RUN_DB_E2E=1 DATABASE_URL=postgresql://.../intern_test npm test

cd ../frontend
npm test
```
