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

export interface ResultRow {
  ca: number;
  exam: number;
  unit: number;
  total?: number | null;
}

/** Returns the effective total score for a result: prefers explicit total_score, else ca+exam. */
export function effectiveTotal(r: { ca_score?: number | string | null; exam_score?: number | string | null; total_score?: number | string | null }): number {
  if (r.total_score !== null && r.total_score !== undefined && r.total_score !== "") {
    return Number(r.total_score);
  }
  return Number(r.ca_score ?? 0) + Number(r.exam_score ?? 0);
}

export function computeGPA(rows: ResultRow[], scale?: GradeBand[]): number {
  if (rows.length === 0) return 0;
  let totalPoints = 0;
  let totalUnits = 0;
  for (const r of rows) {
    const total = Number(r.ca) + Number(r.exam);
    const { point } = computeGrade(total, scale);
    totalPoints += point * r.unit;
    totalUnits += r.unit;
  }
  return totalUnits === 0 ? 0 : totalPoints / totalUnits;
}

/** Level number (100, 200, ...) shown as a College of Health year label. */
export function yearLabel(level: number): string {
  const year = Math.max(1, Math.round(level / 100));
  return `Year ${year}`;
}

/** Levels available for a programme of a given duration. */
export function levelsForDuration(durationYears: number): number[] {
  return Array.from({ length: Math.max(1, durationYears) }, (_, i) => (i + 1) * 100);
}

/**
 * Academic standing for a CGPA on a 5-point scale.
 * College of Health awards use Distinction / Credit / Pass classes.
 */
export function classOfDegree(cgpa: number): string {
  if (cgpa >= 4.5) return "Distinction";
  if (cgpa >= 3.5) return "Upper Credit";
  if (cgpa >= 2.4) return "Lower Credit";
  if (cgpa >= 1.5) return "Pass";
  if (cgpa > 0) return "Fail";
  return "—";
}
