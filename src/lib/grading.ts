import { DEFAULT_GRADING_SCALE, type GradeBand } from "./college-settings";

export interface GradeInfo {
  grade: string;
  point: number;
  remark?: string;
}

/**
 * Resolve a score against a configurable grading scale.
 * Falls back to the institution default scale (70/60/50/45/40) when none is configured.
 */
export function gradeForScore(total: number, scale: GradeBand[] = DEFAULT_GRADING_SCALE): GradeInfo {
  const bands = [...(scale.length ? scale : DEFAULT_GRADING_SCALE)].sort((a, b) => b.min - a.min);
  const band = bands.find((b) => total >= b.min) ?? bands[bands.length - 1];
  return { grade: band.grade, point: band.point, remark: band.remark };
}

export function computeGrade(total: number, scale?: GradeBand[]): GradeInfo {
  return gradeForScore(total, scale);
}

/**
 * Score limits for a terminal result. Total = CA + Exam, out of 100.
 * These are enforced in the UI (ResultsEntryGrid, lecturer.entry), by the
 * report sheet headings, and — as the source of truth — by the
 * results_validate_write() trigger in the database
 * (supabase/migrations/20260930100000_results_integrity_and_lock.sql).
 * Keep all of them in sync if a school ever changes the CA/Exam split.
 */
export const RESULT_LIMITS = { ca: 40, exam: 60, total: 100 } as const;

/** Total = CA + Exam. Missing parts count as 0 only for display of partial rows. */
export function computeTotal(ca: number | string | null | undefined, exam: number | string | null | undefined): number {
  return Number(ca ?? 0) + Number(exam ?? 0);
}

/** Returns an error message for an out-of-range CA/Exam pair, or null when valid. */
export function validateScores(ca: number | null, exam: number | null): string | null {
  if (ca === null || exam === null) return "Both CA and Exam scores are required";
  if (!Number.isFinite(ca) || !Number.isFinite(exam)) return "Scores must be numbers";
  if (ca < 0 || ca > RESULT_LIMITS.ca) return `CA must be between 0 and ${RESULT_LIMITS.ca}`;
  if (exam < 0 || exam > RESULT_LIMITS.exam) return `Exam must be between 0 and ${RESULT_LIMITS.exam}`;
  return null;
}

/**
 * Returns the effective total for a result row: an explicit total_score if the
 * database has one, otherwise CA + Exam.
 */
export function effectiveTotal(r: { ca_score?: number | string | null; exam_score?: number | string | null; total_score?: number | string | null }): number {
  if (r.total_score !== null && r.total_score !== undefined && r.total_score !== "") {
    return Number(r.total_score);
  }
  return computeTotal(r.ca_score, r.exam_score);
}

/**
 * Standard competition ranking ("1224"): pupils with equal averages share a
 * position and the next position is skipped. Input order does not matter.
 */
export function rankByAverage(entries: { id: string; average: number }[]): Map<string, number> {
  const sorted = [...entries].sort((a, b) => b.average - a.average);
  const ranks = new Map<string, number>();
  let lastAvg: number | null = null;
  let lastRank = 0;
  sorted.forEach((e, i) => {
    // Compare at 2 d.p. so 71.4999999 and 71.5 do not split a tie by float noise.
    const avg = Math.round(e.average * 100) / 100;
    if (lastAvg === null || avg !== lastAvg) { lastRank = i + 1; lastAvg = avg; }
    ranks.set(e.id, lastRank);
  });
  return ranks;
}

/** English ordinal for a position: 1st, 2nd, 3rd, 11th, 21st … */
export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) { case 1: return `${n}st`; case 2: return `${n}nd`; case 3: return `${n}rd`; default: return `${n}th`; }
}

/**
 * Generates a teacher's remark from a pupil's average score for the term —
 * used as the Form Master / Head Master remark on the report sheet whenever
 * no one has typed a comment for that pupil into report_card_comments.
 *
 * This is schema-driven rather than hard-coded to A–F: it works against
 * whatever grading_scale the school has configured (useCollegeSettings),
 * bucketing bands into thirds (top/middle/bottom of however many bands
 * exist) rather than assuming a fixed number of grades.
 */
export function autoRemark(average: number, scale: GradeBand[] = DEFAULT_GRADING_SCALE, firstName?: string): string {
  const bands = [...(scale.length ? scale : DEFAULT_GRADING_SCALE)].sort((a, b) => b.min - a.min);
  const index = bands.findIndex((b) => average >= b.min);
  const bandIndex = index === -1 ? bands.length - 1 : index;
  const band = bands[bandIndex];
  const who = firstName?.trim() || "The pupil";

  const tier = bandIndex / Math.max(bands.length - 1, 1); // 0 = top band, 1 = bottom band
  let encouragement: string;
  if (tier <= 0.25) {
    encouragement = "An excellent result this term — keep up the hard work!";
  } else if (tier <= 0.5) {
    encouragement = "A very good result. Continue putting in this effort.";
  } else if (tier <= 0.75) {
    encouragement = "A fair result, but there's clearly room to do better next term.";
  } else {
    encouragement = "This result needs serious improvement — more effort and support at home will help.";
  }

  const avgLabel = Number.isFinite(average) ? average.toFixed(1) : "0.0";
  const gradeLabel = band.remark ? `${band.grade} — ${band.remark}` : band.grade;
  return `${who} had an average score of ${avgLabel}% this term, graded ${gradeLabel}. ${encouragement}`;
}
