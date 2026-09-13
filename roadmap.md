# Primary school conversion — roadmap

Status as of this pass (see NOTES.md for full detail on each item).

## Done
- [x] Rebrand public home, navigation, metadata, and portal shells (Model Day Primary School Kazaure)
- [x] Grading scale converted to primary-appropriate bands, GPA/CGPA hidden (`use_gpa = false`)
- [x] `class_arms` (e.g. 4A/4B), `attendance`, and `report_card_comments` tables added
- [x] `exam_officer` and `admission_officer` roles added to the database (the frontend referenced
      them before they existed — see NOTES.md)
- [x] Students and subject assignments (`course_assignments`) now actually link to a specific
      class arm, not just a class level
- [x] Exam Officer portal: sign in, manage class levels/arms, assign a form master per arm,
      assign any teacher to any class + arm + subject school-wide
- [x] Admission Officer portal: sign in, enrol a pupil, generate a downloadable PDF admission letter
- [x] Report sheet generator: per-pupil PDF with CA/exam/total/grade per subject, class position,
      attendance summary, and form-master/head-teacher comments
- [x] Fixed a matric/admission-number bug: the configured format `{CLASS}/{YY}/{SEQ}` was never
      having `{CLASS}` substituted, so every generated number contained a literal `{CLASS}`
- [x] Fixed Vercel deployment: was configured as a static SPA (server functions would 404 on
      Vercel); now targets Nitro's `vercel` preset so server functions actually run
- [x] Replaced the old college "carryover"-based auto-promotion (which never touched a pupil's
      actual class) with a primary-appropriate version: exam officer configures which class
      follows which, can flag individual pupils to repeat, and promotion still runs
      automatically the moment a new session is created — now doing the right thing

## Known gaps / follow-ups (see NOTES.md)
- [ ] A teacher (`lecturers` row) still belongs to exactly one department — fine for a form master,
      not for a subject teacher who teaches the same subject across several classes
- [ ] The super-admin `AdminShell` nav assumes exam_officer/admission_officer can share it, but
      `ProtectedAdmin` still only allows `super_admin` — those roles currently only reach their own
      dedicated portals (`/exam-officer/*`, `/admission-officer/*`), not the shared admin shell
- [ ] Three copies of the Supabase migrations exist in this repo (`supabase/`, `public/`, `scripts/`)
      and have drifted out of sync — only `supabase/migrations` is real
- [ ] The public `/admissions` self-application flow is still 100% unconverted college content
- [ ] No admin UI yet to bulk-move existing students into a `class_arm_id` (only new admissions
      via the Admission Officer portal get one automatically)
