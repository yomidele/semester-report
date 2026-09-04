# Transform Higher-Institution Portal → Model Day Primary School Kazaure

## What already exists and will be reused

The current app is a full-stack TanStack Start + Supabase system with working auth, dashboards, result entry, report cards, fees, announcements, and role-based access. We keep the engine and re-skin/restructure it for a primary school.

Working today (keep):
- Auth + roles (`user_roles` table, `has_role()`, Supabase auth).
- Admin, staff, and student dashboards + route guards.
- CRUD patterns for faculties/departments/courses/students.
- Result entry grid, status workflow, PDF/spreadsheet export.
- Academic sessions, settings, announcements, fees, timetable, audit logs.
- Existing Supabase storage buckets and RLS patterns.

## What must change

### Terminology & mental model

| Higher institution | Primary school |
|---|---|
| Faculty | School / Class Group |
| Department | Class (e.g. Primary 1) |
| Course | Subject |
| Course Code | Subject Code (optional) |
| Course Registration | Subject Allocation |
| Semester | Term (First, Second, Third) |
| Lecturer | Teacher |
| HOD | Class Teacher / Academic Coordinator |
| Student Level | Class + Arm |
| Course Units / Credits | Remove completely |
| GPA / CGPA | Remove completely |
| Examination Registration | Assessment / Examination |
| University Session | Academic Session |
| Transcript | Student Result / Report Card |

### Academic structure

- **Academic Session**: e.g. 2026/2027, containing First Term, Second Term, Third Term. Admin activates current session and current term.
- **Class Group / School**: logical grouping (e.g. Lower Primary, Upper Primary). Reuses the `faculties` table.
- **Class**: Primary 1 – Primary 6. Reuses the `departments` table.
- **Arm / Section**: A, B, C per class. Added to students and optionally to class records.
- **Subject**: taught per class (and optionally per class group). Reuses the `courses` table.
- **Subject Allocation**: which teacher teaches which subject to which class/arm in which session/term. Reuses `course_assignments`.
- **Student**: belongs to a class + arm; has guardian/parent contacts. Reuses `students`.
- **Teacher**: user profile linked to classes/subjects. Reuses `lecturers`.
- **Assessment**: CA + Exam scores per subject per student per term. Reuses `results`.
- **Report Card**: term summary per student with totals, averages, grades, teacher/class comments. Reuses report-card PDF logic.
- **Promotion**: move student to next class/arm at end of session; graduate from Primary 6. Reuses `student_academic_records`.

### Roles

Simplify to:
- `super_admin` — full access.
- `teacher` — assigned classes/subjects, enter results, view own students, attendance.
- `student` / `parent` — view report cards, fees, timetable, announcements.

Legacy roles (`faculty_admin`, `department_admin`, `lecturer`) are mapped or replaced in code and RLS.

### UI / navigation

Primary navigation becomes:
- Dashboard
- Students
- Teachers
- Classes
- Subjects
- Attendance
- Results
- Report Cards
- Fees
- Timetable
- Announcements
- Academic Session
- Settings

Public site becomes a primary-school landing page: Home, About, Admissions, Academics, News/Events, Contact, Portal login.

### Branding

- Name: **Model Day Primary School Kazaure**.
- Colors: keep deep green/gold Nigerian institutional feel but soften for a primary school.
- Logo: generate a child-friendly school crest/seal for Kazaure.
- Fonts: keep serif headings for formality, rounded sans for body where appropriate.

## Data preservation

- Do NOT reset the database.
- Do NOT drop existing tables unless absolutely necessary.
- Existing `faculties` become Class Groups.
- Existing `departments` become Classes (data backfilled/mapped).
- Existing `courses` become Subjects; `unit` column is ignored, not deleted.
- Existing `lecturers` become Teachers.
- Existing `students` are re-mapped to class + arm.
- New migrations add `arm` columns, `term` instead of `semester` usage, and primary-school-specific tables (attendance, report-card comments, class arms) without breaking old rows.
- Seeding: add demo Primary 1–6 classes, arms, subjects, teachers, students, and a sample session/term for the new school.

## Phased delivery

### Phase 1 — Foundation & cleanup
- Remove duplicate `src/src/`, `public/src/`, `scripts/src/` folders (done).
- Audit current routes, fix broken imports, verify build passes.
- Create migration: add `arm` to students/classes, `current_term` to academic settings, `report_card_comments` table, `attendance` table, `class_arms` table.
- Seed default Model Day Primary School data: class groups, classes Primary 1–6 with arms A/B, core subjects, 2026/2027 session with three terms, demo admin/teacher/student users.
- Update `college_settings` → school name, motto, contact details, logo.

### Phase 2 — Terminology & role refactor
- Update app-wide labels: Course → Subject, Department → Class, Semester → Term, Lecturer → Teacher, Transcript → Report Card.
- Simplify role checks: replace faculty_admin/department_admin/lecturer with super_admin/teacher/student in UI guards and RLS where possible.
- Update route titles and navigation.
- Rename route files only where it improves clarity; keep URLs stable where possible.

### Phase 3 — Class / subject / student management
- Admin screens: Class Groups, Classes, Arms, Subjects, Subject Allocation.
- Student creation/edit with class + arm assignment.
- Teacher creation/edit with class/subject assignment.
- Remove course-unit and GPA/CGPA fields from forms and displays.

### Phase 4 — Attendance
- Daily attendance register per class/arm.
- Teacher marks present/absent/late.
- Parent/student view attendance summary.

### Phase 5 — Results & report cards
- Result entry per class/subject/term (CA + Exam, no units).
- Compute total, percentage, grade per subject.
- Class teacher comments and head teacher comments.
- Generate term report card PDF (student info, subjects, totals, average, grade, attendance, comments, school logo).
- Remove transcript/CGPA flows.

### Phase 6 — Promotion & academic session
- End-of-session promotion: move students to next class/arm, graduate Primary 6.
- Activate session/term controls.

### Phase 7 — Fees, timetable, announcements
- Simplify fee categories for primary school (tuition, uniform, books, PTA, exam).
- Term-based invoices and receipts.
- Timetable per class/arm.
- Announcements scoped to school/class.

### Phase 8 — Public website & polish
- Rebrand public site to Model Day Primary School Kazaure.
- New hero, about, admissions, academics, news/events, contact pages.
- Portal login links for Admin/Teacher/Parent.
- Mobile responsiveness and UI consistency pass.

### Phase 9 — Final audit
- Build check, typecheck, route check.
- Test: auth, admin login, teacher login, student/parent login, role permissions, student creation, teacher creation, class creation, subject creation, subject allocation, attendance, result entry, report card PDF, promotion, announcements, fees, timetable, dashboard stats, search/filter, mobile responsiveness.
- Fix all errors; no TODOs or placeholder functionality.

## Security

- Every new table gets RLS + GRANTs.
- Teachers see only their assigned classes/subjects/students.
- Students/parents see only their own records.
- Admins see everything.
- Sensitive actions write to `audit_logs`.
