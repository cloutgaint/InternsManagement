# Frontend structure

The frontend uses Next.js Pages Router. Each screen has a named route file,
so a separate directory is not needed for each page.

```text
frontend/
  pages/
    _app.js                      Shared navigation, metadata, and global CSS
    _document.js                 HTML document with lang="en"
    index.js                     /
    login.js                     /login
    register.js                  /register
    admin/
      index.js                   /admin
      assessments.js             /admin/assessments
      attendance.js              /admin/attendance
      audit.js                   /admin/audit
      batches.js                 /admin/batches
      colleges.js                /admin/colleges
      ...                        Remaining admin route files
    mentor/
      index.js                   /mentor
      collaboration.js           /mentor/collaboration
      final-evaluations.js        /mentor/final-evaluations
      operations.js              /mentor/operations
      reports.js                 /mentor/reports
    intern/
      index.js                   /intern
      assessments.js             /intern/assessments
      attendance.js              /intern/attendance
      ...                        Remaining intern route files
  modules/
    tasks/
      AdminTasksPage.js
      InternTasksPage.js
    assessments/
      AdminAssessmentsPage.js
      AdminQuestionsPage.js
      InternAssessmentsPage.js
    ...                          Other business features
  shared/
    globals.css                  Existing application styles
    api/client.js                Shared HTTP client
  components/Dashboard.js         Existing reusable dashboard component
  lib/api.js                      Compatibility export for existing imports
```

The three role folders contain files directly. Route files render feature
screens from `modules/`; feature files contain the existing UI and workflows.
Keep related admin, mentor, and intern implementations in the same feature
folder with descriptive filenames. Add subfolders only when the feature has
enough files to justify them.

Use `@/modules/...`, `@/shared/...`, and `@/components/...` imports.
Global styles are imported once in `pages/_app.js`. Shared navigation and
page metadata also live there; `pages/_document.js` defines the HTML shell.

All 37 application URLs retain their existing paths. For example,
`pages/admin/attendance.js` still serves `/admin/attendance`. The original
route files were relocated from `app/`, and the empty route directories
were removed. Feature screens and backend behavior are unchanged.

## Optional editor workspace

Open `gaint-intern-management.code-workspace` from the repository root using
VS Code's **File → Open Workspace from File**. It presents feature screens,
shared frontend code, backend, Next.js pages, and project configuration as
separate roots. Dependency and build output folders are hidden in this view.
The flat page-file structure also works when opening the repository normally.

## Development

Run `npm run dev` from `frontend/`. Run `npm run build` to verify routes,
compilation, and static rendering before using `npm start`.
