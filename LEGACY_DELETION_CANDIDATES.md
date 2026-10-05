# Legacy / Deletion Candidates

No file in this list should be deleted without explicit approval.

| File | Functionality | Replaced by | Still imported? | Deletion risk |
|---|---|---|---|---|
| `backend/src/routes/auth.js` | Original combined auth, registration, upload, MFA, and user route implementation | `backend/src/modules/auth/` | No application import; `backend/src/server.js` mounts the module router | Medium: external scripts or undocumented direct imports may still depend on the old path |
