# Route organization

Routes are grouped by API role so a change has a clear owner and unrelated roles do not share a file.

- `admin/` contains the Admin composition router, workflow routes, and batch-allotment routes.
- `intern/` contains the Intern API router.
- `mentor/` contains the Mentor API router.
- `shared/` contains routers intentionally mounted by more than one role, such as task plans.

Each role exposes an `index.js` entry point. `app.js` imports only those entry points; feature files may be split further inside their role folder without changing the application bootstrap or public API paths.
