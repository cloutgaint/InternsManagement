# Requirements traceability: Blueprint v1.2

Verified by `backend/tests/blueprint-workflow-e2e.test.js`, which walks the lifecycle over HTTP against PostgreSQL (`RUN_DB_E2E=1`). "Needs setup" means the code exists but does nothing until GAINT supplies the named configuration.

| Blueprint area | Status | Where |
|---|---|---|
| Registration, consent; optional photo and resume (5.1) | Done | `modules/auth`, `/register` |
| Proof fields, 2 files, type and size checks, duplicate flags (5.2, 5.3) | Done | `services/proofService.js`, `/admin/verification` |
| Verified / Re-upload / Rejected; Super Admin override with due date (5.4) | Done | `POST /admin/proofs/:id/verify`, `/application-status` |
| Approve / Reject / Request Correction (Step 3) | Done | `POST /admin/interns/:id/{approve,reject,request-correction}` |
| Bulk allotment orders and roll-number linking (5.5) | Done | `routes/batchAllotmentOrders.js` |
| Date-mismatch: revised letter, intern end date, override (5.6) | Done | `POST /admin/allocate`, re-flagged on batch date changes |
| Proof encryption, audited access, malware scan, retention (5.7) | Needs setup | `FILE_ENCRYPTION_KEY`, `CLAMAV_HOST`, `PROOF_RETENTION_DAYS` |
| Domain Master, sub-domains, rubrics, capacity (6) | Done | `/admin/domain-master` |
| Deliverable types per task and project (6.4) | Done | tasks, projects, templates |
| MCQ-only assessments (Frontend and Backend sections for development); AI drafts reviewed (6.5, 7) | Done | `routes/intern.js`, `/admin/questions` |
| AI question generation (7.2) | Needs setup | `services/aiQuestionService.js` provider configuration |
| Recommendation is advisory; Admin confirms or changes with reason (Steps 10-11) | Done | `POST /admin/domain-confirm` |
| Single-domain and cross-functional proposals, merge, split, history (Steps 12-13) | Done | `/admin/groups`, `group_history` |
| Mentor assignment, reassignment (Step 14); mentors see only their allotted interns | Done | `/admin/mentors`, `services/mentorScope.js` |
| One batch and one active group per intern | Done | `services/groupMembership.js`, migration 1006 |
| Offer letter: Draft, Previewed, Approved, Issued, Reissued, Revoked (8.1) | Done | `/admin/offers` |
| Offer delivery by email (8.1, 23) | Not built | Portal view and PDF only; decide per Section 23 |
| Face enrollment, approval, re-enrollment (9.1) | Done | `/admin/attendance`, `/intern/face-enrollment` |
| Camera match and head-turn liveness (9.1) | Needs setup | `biometric-verifier`, `BIOMETRIC_VERIFY_URL` |
| Present / Late / Absent / On Leave / Holiday; retry before exception; corrections (9) | Done | `attendance_calendar`, `services/attendanceService.js` |
| Leave, holidays, limits; Mentor or Admin approval (9.2) | Done | `/admin/leave`, `/mentor/operations` |
| Attendance mode On-site / Remote (9.2) | Recorded only | Stored per batch; no location or device checks, as the blueprint allows initially |
| Scheduled release, pause, reschedule, publish, domain templates (10) | Done | `/admin/tasks` |
| Plagiarism / AI-content check (10) | Not built | Optional in the blueprint |
| Rubric evaluation; Approved / Rework / Rejected (Step 21) | Done | `/mentor` |
| Fortnight schedule, rubric fields, individual marks, publish gate (11) | Done | `/mentor/reports` |
| Group chat, moderation, document centre, announcements (12) | Done | `/admin/documents` |
| Group / individual weights and pass mark; attendance gate (13) | Done | `POST /admin/completions/:id/decision` |
| Completed / Incomplete / Extended / Withdrawn / Terminated (Step 27) | Done | `/admin/completion` |
| In-app and offline certificates; verification by ID (13.1) | Done | `/verify-certificate` |
| Certificate QR code; participation letter (13.1) | Not built | Both optional in the blueprint |
| College completion report and coordinator email (13.1) | Done (email needs SMTP) | `/admin/reports` |
| Notifications for all roles; reminders (17) | Done | `/notifications`, `services/taskReleaseScheduler.js` |
| Email delivery (17) | Needs setup | `SMTP_HOST` |
| Reports; CSV and PDF export (18) | Done | `/admin/reports` |
| Native .xlsx export (18) | Not built | CSV opens in Excel |
| RBAC, MFA, password reset and change, session revocation, audit (19) | Done | `common/security`, `modules/auth` |
| College coordinator login (3, optional later phase) | Done | `/college-coordinator` |

## Decisions GAINT still owns (Section 23)

Retention periods, who may override proofs and the grace period, launch domains, rubric weights, fee or stipend handling, and the biometric technology and fallback process.
