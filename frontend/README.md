# Frontend structure

## Editor workspace

Open `gaint-intern-management.code-workspace` from the repository root using
VS Code's **File → Open Workspace from File**. Its Explorer presents feature
screens first, followed by shared frontend code, backend, Next.js routes, and
project configuration. Keep the Next.js routes section collapsed while working
on screens. Automatic file reveal is disabled so navigating to a route adapter
does not repeatedly expand the routing tree.

The project configuration view excludes directories already exposed as their
own workspace roots. Dependency and build output folders are hidden from the
Explorer. These are workspace display settings; all source files remain on
disk and application routing and build commands are unchanged. Opening the
repository as an ordinary folder still shows the original directory tree.

## Source layout

Next.js App Router uses directories as URL segments. For example,
`app/admin/tasks/page.js` defines `/admin/tasks`. Keep these route files in
place when organizing application code; naming a file `app/admin/tasks.js`
would not define the same route.

Route folders consume negligible disk space. The benefit of this structure is
clear ownership and easier navigation through descriptive implementation names.

```text
frontend/
  app/                         Next.js URLs, layout, global styles
    admin/tasks/page.js        Thin entry for /admin/tasks
    intern/tasks/page.js       Thin entry for /intern/tasks
  modules/
    tasks/
      AdminTasksPage.js
      InternTasksPage.js
    assessments/
      AdminAssessmentsPage.js
      AdminQuestionsPage.js
      InternAssessmentsPage.js
    attendance/
      AdminAttendancePage.js
      InternAttendancePage.js
      InternFaceEnrollmentPage.js
    auth/
      LoginPage.js
      RegisterPage.js
    ...                        Other feature folders follow the same pattern
  shared/api/client.js         Shared JSON, upload, and download client
  components/Dashboard.js      Existing reusable dashboard component
  lib/api.js                   Compatibility export for existing imports
```

Feature files live directly inside their feature folder. Role names appear in
filenames, so related admin, mentor, and intern screens stay together. Add
component, hook, or API files only when they have a concrete responsibility;
create subfolders only when a feature has enough files to justify them.

Use `@/modules/...`, `@/shared/...`, and `@/components/...` imports. Each role,
login, and registration route renders its corresponding feature page. The
small home page, root layout, and global stylesheet stay under `app/`.

The dashboards folder contains the role dashboards and the existing combined
work/operations screens. Onboarding verification and offers belong to interns;
completion and certificates belong to certificates; questions belong to
assessments; audit, performance, and work logs belong to reports.

This relocation preserves existing page implementations and workflows. Further
splitting of large pages should be done feature by feature with behavior checks.
