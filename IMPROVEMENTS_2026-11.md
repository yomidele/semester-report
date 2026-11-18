# Portal improvements — November 2026

## Database update to run (Supabase → SQL Editor)
`supabase/migrations/20261117100000_term_completion_and_promotion.sql`
(also supplied separately as `run_in_supabase_promotion_system.sql`). Safe to run more than once.
Adds term-completion dates to sessions, removes the old "promote on session creation" trigger,
extends `student_class_history` into the permanent promotion record, adds `promotion_candidates`,
`run_promotion`, `reverse_promotion`, a promotion policy on `college_settings`, and special-promotion
fields on `students`. No existing rows are changed except filling empty "next class" links between
classes that already exist (Nursery 1 → … → Primary 6 → JSS 1 → … → SS 3).

## Navigation (all five portals)
- `components/PortalShell.tsx` is now the one layout for Super Admin, Teacher / Form Master,
  Exam Officer and Admission Officer. Desktop (≥1024px): sticky sidebar. Phone/tablet: bar with
  the current page name and a Menu button opening the full navigation in a drawer.

## Shared components
- Input / Textarea / Select: 40px tall, 16px text on phones (no iOS zoom), visible caret, clear
  focus ring, solid background for contrast, never wider than their container.
- Number inputs: spinner arrows removed so digits get the full width.
- Table: header cells don't wrap, consistent header style, horizontal scroll contained in the table.
- Dialog / AlertDialog: fit the viewport (max height, scroll inside), stacked buttons with spacing on phones.
- Dropdown menus never wider than the screen.

## Results
- Teacher Results Entry (`/lecturer/entry`): school name, session and term banner, "Enter Results",
  subject/class picker, pupil search, Save Draft and Submit for Approval. Desktop table:
  S/N, Name, Class, Reg. No., CA, Exam, Total, Status. Phones: one card per pupil with large CA/Exam
  boxes side by side (stacked under 360px), live total and status. Validation, Enter-to-next-box and
  on-device draft safety net unchanged.
- Admin/Exam Officer entry (`/result-entry`): same banner, columns, status badges, phone cards.
  Save button renamed "Submit for Approval" (it always sent results for approval).
- Review Results (`/exam-officer/results`): class column, S/N, status badges, phone cards.

## Class names (display only — no data renamed)
- `lib/class-display.ts`: results pages show "Primary 4A"; report cards, transcripts and admission
  letters show "Primary 4". The report-card generator enforces this itself.

## Student promotion
- `/admin/promotions` (Super Admin): sessions, term progress, policy, review list with per-pupil
  decisions, run with confirmation, permanent history with "Correct" (reverse) action.
- `/sessions`: mark First / Second / Third term complete and close the session, in order.
- Dashboard: Student Promotion summary card.

## Tests run
- Promotion SQL on Postgres 16 with Nursery 1–SS 3: 34 scenarios (gating per term, closure, preview,
  promotion, arms, faculty, repeaters, SS3 completion, review flags, special promotion, duplicates,
  reversal, policy minimum average, reruns).
- Class-name helper: 16 cases.
- Every edited file: parse + type check against stubbed packages.
- Not run here: the app itself in a browser (packages could not be installed offline).
