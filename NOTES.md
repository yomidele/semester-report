# Engineering notes — primary school completion pass

## What changed in this pass

1. **Migrations** (`supabase/migrations/20260912100000_*.sql`, `20260912100100_*.sql`)
   - Added `exam_officer` and `admission_officer` to the `app_role` enum. The
     frontend (`src/hooks/use-role.ts`) already had `isExamOfficer` /
     `isAdmissionOfficer` referencing these roles before they existed in the
     database — they were always `false`.
   - Added `class_arms.form_teacher_id` (references `lecturers`).
   - Added `students.class_arm_id` and `course_assignments.class_arm_id`
     (both nullable — null on `course_assignments` means "the whole class
     level", matching prior behaviour).
   - Added RLS policies for the two new roles on `class_arms`,
     `course_assignments`, `departments`, `faculties`, `lecturers`, `courses`,
     `students`, `results`, and `report_card_comments`.
   - `src/integrations/supabase/types.ts` was hand-edited to match (no DB
     connection available to run `supabase gen types` — please regenerate
     properly once you can connect, and diff against this).

2. **Bug fix**: `college_settings.matric_format` is configured as
   `{CLASS}/{YY}/{SEQ}` for this school, but `{CLASS}` was never substituted
   in `student-registration.functions.ts` (self-registration) or
   `applicant.functions.ts` (admit-from-application). Every generated matric
   number contained a literal `{CLASS}` string. Fixed in both places, and the
   new `enrollStudent` function handles it correctly from the start.

3. **New: `src/lib/school-admin.functions.ts`** — server functions:
   `createExamOfficer` / `deleteExamOfficer`, `createAdmissionOfficer` /
   `deleteAdmissionOfficer`, `createClassLevel`, `createClassArm`,
   `assignFormMaster`, `enrollStudent`.

4. **New: Exam Officer portal** — `ProtectedExamOfficer`, `ExamOfficerShell`,
   `/exam-officer/login`, `/exam-officer/dashboard`, `/exam-officer/classes`
   (class/arm CRUD + form master assignment), `/exam-officer/assignments`
   (school-wide teacher assignment), `/exam-officer/report-sheets` (PDF
   generation, `src/lib/report-sheet.ts`).

5. **New: Admission Officer portal** — `ProtectedAdmissionOfficer`,
   `AdmissionOfficerShell`, `/admission-officer/login`,
   `/admission-officer/dashboard`, `/admission-officer/enroll` (enrolment
   form + PDF admission letter via `src/lib/admission-letter.ts`).

6. **New: `/admin/staff-officers`** — lets the Super Admin create/remove Exam
   Officer and Admission Officer login accounts (previously there was no UI
   for this at all).

7. Fixed two dead links in `AdminShell.tsx` (`/admin/programmes` and
   `/examofficer/assignments` pointed nowhere) to point at the real
   `/exam-officer/classes` and `/exam-officer/assignments` pages.

8. Deleted `IMPLEMENTATION_SUMMARY.md` and `VALIDATION_SYSTEM.md` (100%
   stale content describing the original college-of-health-technology
   project — "Shalom College of Education", GPA/CGPA exports, matric-number
   validation — none of which applies here). Rewrote `README.md` and
   `roadmap.md` to reflect the actual system.

## Known issues / things to decide next

- **`AdminShell` assumes a unified admin shell for all three staff roles,
  but `ProtectedAdmin` only allows `super_admin`.** The nav in `AdminShell`
  filters items by role and expects exam/admission officers to be able to
  use it, but if one of them actually visits `/dashboard`, `ProtectedAdmin`
  redirects them to `/login` because it hard-checks `isSuperAdmin` only.
  Right now exam/admission officers only work through their own dedicated
  portals (`/exam-officer/*`, `/admission-officer/*`), which is a fully
  working experience — but the shared-shell nav items visible only to
  super_admin are the only ones that currently do anything. Decide whether
  to (a) keep two separate portals long-term, or (b) update `ProtectedAdmin`
  to allow all three roles and give exam/admission officers a cut-down view
  of the shared shell. I picked (a) for this pass since it required no
  changes to existing, working super-admin code paths.

- **A teacher can only belong to one class level.** `lecturers.department_id`
  is a required single column — fine for a form master, but a real subject
  teacher (e.g. a Maths teacher who teaches 4A, 4B, and 5A) can't be
  represented as one `lecturers` row today. `course_assignments` can point
  the *same* `lecturer_id` at multiple classes/arms, so this mostly works in
  practice, but the teacher's own "home" department is still singular and
  some existing dept-scoped screens (e.g. `dept-admin.lecturers.tsx`) assume
  a teacher belongs to the admin's one department. Not changed in this pass
  — flagging for a decision on whether to make `lecturers.department_id`
  nullable/advisory only.

- **Three copies of the migrations folder exist**: `supabase/migrations/`
  (the real one — 9 files, most recent Sept 5), `public/supabase/migrations/`
  (6 files, missing the two most recent), and `scripts/supabase/migrations/`
  (9 files, but a *different* 9 — it has three files not present anywhere
  else: `20260828190000_add_result_pin_system.sql`,
  `20260829000000_add_result_pin_voucher_bucket.sql`, plus the same
  `20260828120000_add_news_posts.sql` also in `public/`). None of this was
  touched in this pass — figure out which is authoritative (almost
  certainly `supabase/migrations/`) and delete or reconcile the other two
  before they cause confusion about what's actually been applied to the live
  database.

- **The public `/admissions` page and `admin.applications.tsx`** are
  untouched college content (O'Level requirements, "clinical postings",
  programme-based application). Not converted in this pass since the
  Admission Officer portal (staff-entered, no public self-application) covers
  the stated requirement. Decide whether the public apply flow should be
  deleted, or converted into a "parent pre-registers interest" flow that
  still routes through the Admission Officer for the actual decision.

- **Existing students don't have a `class_arm_id`.** Only pupils enrolled
  through the new Admission Officer flow get one automatically. There's no
  bulk-assignment screen yet for backfilling existing records.

## Vercel deployment fix (this pass, part 2)

The repo had a `vercel.json` configured for **static SPA hosting**
(`outputDirectory: dist/client` + a catch-all rewrite to `index.html`), paired
with `scripts/postbuild.mjs` synthesizing a plain `index.html`. That combination
serves the client bundle only — it has no server runtime, so every
`createServerFn` (enrollment, admission/exam officer account creation, faculty
admin creation, student self-registration, etc.) would silently fail in
production, since those functions need to run server-side with the
service-role Supabase key.

Fixed by:
- `vite.config.ts`: added `nitro: { preset: "vercel" }` so the TanStack
  Start/Nitro build emits a proper Vercel serverless function (Build Output
  API v3) instead of targeting Cloudflare Pages (Lovable's own default).
- `vercel.json`: reduced to just `{ "buildCommand": "npm run build" }` so
  Vercel auto-detects Nitro's generated `.vercel/output` instead of being
  told to serve a static `dist/client` folder.
- `package.json`: `build` script no longer runs `scripts/postbuild.mjs` —
  that script's static-`index.html` hack is now unnecessary (and would look
  in the wrong output directory anyway under the new preset). Left the file
  in place with a note, in case you ever need pure static hosting again —
  it also still has stale "SCOE Pambula Michika" branding in the HTML title
  it generates, unfixed since it's no longer in the active build path.

**Not verified**: no network access here to actually run `vercel build` or
deploy. Please run `npm run build` locally, then `vercel deploy` (or connect
the repo in the Vercel dashboard) and confirm a server function actually
executes (e.g. try the Admission Officer enrol flow) before considering this
done.

You'll need to set these as **Environment Variables** in the Vercel project
settings (Lovable was setting these automatically via "Lovable Cloud" —
that won't exist on Vercel, so nothing works until you add them yourself):
- `SUPABASE_URL` — used server-side by `client.server.ts` (service-role client)
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only, never expose this to the client
- `VITE_SUPABASE_URL` — same URL, used client-side (Vite inlines `VITE_`-prefixed vars into the browser bundle at build time)
- `VITE_SUPABASE_PUBLISHABLE_KEY` — the anon/publishable key, client-side

If you're moving to your own Supabase project as discussed above, all four
values come from that new project's API settings page, not the old one.


Also note: there are duplicate `vercel.json` files under `src/`, `public/`,
and `scripts/` in this repo (identical stale content) — only the root
`vercel.json` is real. Same pattern as the duplicated migrations folders
above; worth cleaning out at some point.

## Promotion & repeat-a-class fix (this pass, part 3)

The original college project had `promote_students_to_session()`, wired to fire
automatically whenever a new academic session was created. It decided
promotion based on "carryover" (failing one specific subject) and only ever
touched a college-specific `student_academic_records.level` field
(100/200/300/400) — it never updated `students.department_id` or
`class_arm_id`, so even where it ran it couldn't actually move a primary
pupil into the next class anywhere the rest of the app reads from. There was
also no way for a teacher, form master, or exam officer to manually hold a
specific pupil back regardless of that automatic decision.

Fixed in `20260913090000_primary_promotion_and_repeat.sql`:
- Dynamically finds and drops whatever trigger currently calls
  `promote_students_to_session` (its exact name isn't in this repo's
  migration history — see the base-schema gap noted earlier in this file —
  so this is done via a `pg_trigger` lookup rather than a hardcoded
  `DROP TRIGGER <name>`).
- Adds `departments.next_department_id` — an explicit, exam-officer-editable
  chain of "what class comes after this one" (set from the new **Class
  progression** section on `/exam-officer/classes`).
- Adds `students.repeat_flag` — settable per pupil from the new
  `/exam-officer/promotions` page, before a new session is created.
- Adds `student_class_history` — a permanent record of every
  promoted/repeated/completed-final-class outcome, per pupil, per session.
- Adds `promote_primary_students(session_id)` — the new, primary-appropriate
  replacement: skips anyone flagged to repeat (and clears their flag),
  otherwise moves a pupil to `next_department_id` (clearing `class_arm_id`,
  since arms are specific to one class and the new class's arms need to be
  assigned fresh), or — if no next class is configured — records them as
  having completed their final class without changing their record.
- Re-wires this to `academic_sessions` via `trg_academic_sessions_promote_primary`
  (`AFTER INSERT`), so promotion is still fully automatic on session
  creation, matching the previous behaviour/UX in `sessions.tsx` — just
  correct this time. `sessions.tsx` now reads its post-creation summary from
  `student_class_history` instead of the old `student_academic_records`.

**Workflow this creates**: before creating a new session, the exam officer
visits `/exam-officer/promotions`, picks a class/arm, and ticks "repeat this
class" for any pupil who shouldn't move up. Everyone left unticked is
promoted automatically the moment the new session is created on `/sessions`.
A super admin can reach the same page too (`ProtectedExamOfficer` allows
`super_admin` as well as `exam_officer`).

**Not done / worth knowing**: a pupil whose class has no `next_department_id`
configured (e.g. Primary 6, if nothing is set to follow it) is recorded as
`completed_final_class` but their `department_id` is left unchanged — there's
no "graduated"/"left the school" status on the `students` table itself. If
the school wants JSS1 onward eventually, add that department and link
Primary 6 → JSS1 via the Class progression screen and it'll just work; if
Primary 6 is genuinely the end of the road for this school, decide what
should happen to those pupils' records (archive, mark inactive, etc.) — not
built here since it wasn't part of the original ask.

## A note on verification

This sandbox has no network access, so none of the above was verified with
`npm install` / `npm run build` / a real Supabase connection. Please run a
full build and, ideally, apply the two new migrations to a staging database
before deploying, and report back any TypeScript or runtime errors so they
can be fixed.

## Small fix: grade entry wasn't respecting a per-arm assignment

`lecturer.entry.tsx` (where a teacher enters scores) filtered students by
`department_id` + the course's `level` only — it never checked
`course_assignments.class_arm_id`. So a teacher assigned to teach Maths to
4A only would have seen every pupil in Primary 4 (both arms) when entering
scores. Fixed: the query now also filters by `class_arm_id` when the
assignment has one set.
