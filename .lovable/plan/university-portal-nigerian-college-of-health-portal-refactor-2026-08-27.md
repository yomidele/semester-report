# University Portal → Nigerian College of Health Portal (Refactor, not rebuild)

## What already exists and will be reused as-is

Your app is already a multi-portal academic system. Almost every core piece maps directly onto a College of Health.

Working today (keep):
- Auth + roles: `user_roles` table with `app_role` enum (super_admin, faculty_admin, department_admin, lecturer, student), `has_role()` and `current_faculty_id()` security-definer functions, per-portal login pages and route guards (`ProtectedAdmin`, `ProtectedFaculty`, `ProtectedDeptAdmin`, `ProtectedLecturer`, `ProtectedStudent`).
- Structure: `faculties` → `departments` → `courses` → `students`, plus `academic_sessions`, `academic_settings`, `student_academic_records` with automatic level promotion.
- Student portal: dashboard, profile, course registration (`course_registrations`, `course_registration_items` with min/max unit rules), results, carryovers.
- Lecturer portal: course assignments, result entry grid, draft/submit flow.
- Result workflow: `results` with status (draft → submitted → approved → published), returned-reason, dept/faculty approval screens, audit logging, carryover trigger.
- Transcripts + PDF generation (jsPDF), spreadsheet generator, validation audit, registration links, self-registration with configurable matric sequence (`next_matric_seq`).

Terminology only (no logic change): "University" → "College", "Faculty Admin" → "School/Faculty Admin". `faculties` table stays and is presented as Schools/Faculties.

## What is missing and must be added

New tables (additive; nothing dropped):
- `programmes` (school/department, name, code, duration_years, uses_gpa, active) + `programme_id` and `duration`-aware level handling on `students`, `courses`, `course_registrations`.
- `college_settings` (name, logo, address, phone, email, socials, matric format, grading scale JSON, result/report/transcript/PIN settings).
- Admissions: `applicants`, `applications` (+ documents, status Draft→Submitted→Under Review→Accepted→Rejected→Admitted), admit-to-student conversion.
- Fees: `fee_categories`, `fee_assignments`, `invoices`, `payments`, `receipts`. (No Paystack integration exists yet — architecture prepared, provider wired only if you want it.)
- `result_pins` (student, session, semester, uses, expiry, active/used) + backend-only validation for public result checking.
- `announcements` (scope: college/school/department/programme/level).
- `clinical_postings` and `industrial_attachments` (minimal, expandable).
- `audit_logs` as a real table (currently logging is app-side only).

Changes to existing behaviour:
- Grading moves from hard-coded `computeGrade()` in `src/lib/grading.ts` to a configurable scale stored in `college_settings`, with the current 70/60/50/45/40 scale seeded as the default so nothing changes visually.
- Level/year stops assuming 100–400. Programme duration drives levels (Year 1..N), including 2- and 3-year programmes. `promote_students_to_session()` is rewritten to promote by programme duration and graduate at the final year.
- Public site: current landing page is a stub; becomes a full College of Health website (Home, About, Schools, Departments, Programmes, Admissions, News, Events, Contact + Apply Now / Student Portal / Staff Portal).

## Data preservation

Existing faculties, departments, courses, students, results, registrations and sessions are kept. Migration backfills a default programme per department so current students/courses attach cleanly, and maps existing levels 100/200/300/400 to Year 1–4.

## Phased delivery

1. **Phase 1 (next step)** — Schema migration: programmes, college_settings, audit_logs, programme-aware levels + duration, configurable grading; backfill existing data; RLS + GRANTs for every new table. Then terminology sweep (College / School-Faculty) and an admin Settings + Programmes management screen.
2. Public College of Health website (design pass: Nigerian institutional look, deep green/gold branding kept, serif headings, no SaaS-dashboard feel).
3. Admissions & applicant portal.
4. Student portal expansion (fees, receipts, timetable, calendar, announcements, documents, change password).
5. Course registration by programme/level/semester.
6. Lecturer portal + configurable grading in result entry.
7–9. Departmental Admin, School/Faculty Admin, Super Admin dashboards & stats.
10. Result approval/publication hardening + audit log UI.
11. Result PINs + public Check Result page (backend-validated).
12. Report card + transcript PDFs (A4, logo, photo, GPA/CGPA when programme uses it, QR-ready verification number).
13. Fees & payments.
14. Clinical/practical training + industrial attachment architecture.

## Security

Every new table gets RLS scoped by role: students see only their own rows; lecturers only assigned courses; department admins only their department; school admins only their school; super admin everything. PIN validation and payment verification run server-side only. Sensitive actions write to `audit_logs`.
