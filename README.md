# Model Day Primary School Kazaure — School Portal & Result Management System

A school website and result management system for a primary school, built with
Vite + React + TanStack Router/Start, Supabase (Postgres + Auth + Storage), and
Tailwind. Originally adapted from a college-of-health-technology result
management system; converted for a primary school with Primary 1–6, each split
into class arms (e.g. 4A, 4B), extensible by the school as needed.

See `roadmap.md` for current status and `NOTES.md` for a detailed engineering
log of what changed in the most recent pass and what's still open.

## Roles

- **Super Admin** — full control: settings, sessions/terms, subjects, staff accounts.
- **Exam Officer** (`/exam-officer`) — creates class levels/arms, assigns a
  form master per arm, assigns teachers to classes+subjects school-wide,
  compiles report sheets.
- **Admission Officer** (`/admission-officer`) — enrols new pupils and issues
  PDF admission letters.
- **Teacher** (`/lecturer`) — enters CA and exam scores for assigned subjects.
  A teacher who is also a form master gets class-wide visibility for their arm.
- **Student/Parent** (`/student`) — views results, report sheets, attendance.

## Local development

```bash
npm install
npm run dev
```

This project's Supabase schema lives only in `supabase/migrations/` — the
copies under `public/` and `scripts/` are stale and should not be edited or
relied on (see NOTES.md).

## Key primary-school concepts

- **Class level** (`departments` table) — e.g. "Primary 4".
- **Class arm** (`class_arms` table) — e.g. "Arm A" / "Arm B" under a class
  level, each optionally assigned a form master.
- **Admission number** — generated from `college_settings.matric_format`
  (currently `{CLASS}/{YY}/{SEQ}`) when a pupil is enrolled.
- **Report sheet** — a per-term PDF combining subject scores, class position,
  attendance, and comments; generated from the Exam Officer portal.
