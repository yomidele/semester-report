// How a pupil's class is written depends on where it appears. These are
// display rules only — nothing here renames a class or arm in the database.
//
//   Results pages (entry, management, approval):   "Primary 4A"
//   Report cards and other exported documents:     "Primary 4"
//
// A class is a `departments` row (name "Primary 4"); an arm is a
// `class_arms` row with a display name the school can edit ("Arm A",
// "Arm 4A", "M.E.", …) and a short code ("A"). The short code is the most
// reliable source for the letter, so it is tried first.

type ArmLike = { name?: string | null; code?: string | null } | null | undefined;

const SHORT_SUFFIX = /^[A-Za-z]{1,2}$/;

function classNumber(className: string): string | null {
  return className.trim().match(/(\d+)\s*$/)?.[1] ?? null;
}

/** The arm's letter(s) relative to its class: "Arm 4A" in Primary 4 → "A". */
export function armSuffix(className: string, arm: ArmLike): string {
  if (!arm) return "";
  const num = classNumber(className);
  const clean = (raw: string | null | undefined) => {
    let s = (raw ?? "").trim().replace(/^arm\b[\s.:-]*/i, "").trim();
    if (num && s.startsWith(num) && s.length > num.length) s = s.slice(num.length).trim();
    return s;
  };
  for (const candidate of [arm.code, arm.name]) {
    const s = clean(candidate);
    if (SHORT_SUFFIX.test(s)) return s.toUpperCase();
  }
  return clean(arm.name) || clean(arm.code);
}

/** Results pages: "Primary 4A". Falls back to "Primary 4 Gold" for word-named arms. */
export function resultsClassLabel(className: string | null | undefined, arm?: ArmLike): string {
  const base = (className ?? "").trim();
  if (!base) return arm ? armSuffix("", arm) || "—" : "—";
  const suffix = armSuffix(base, arm);
  if (!suffix) return base;
  return SHORT_SUFFIX.test(suffix) && /\d$/.test(base) ? `${base}${suffix}` : `${base} ${suffix}`;
}

/**
 * Report cards and exported documents: the class only, never the arm.
 * Accepts a bare class name, or an older combined label such as
 * "Primary 4 — Arm A", "Primary 4 Arm 4A", "Primary 4A" or "Primary 4 M.E."
 * and reduces it to "Primary 4".
 */
export function reportClassLabel(label: string | null | undefined): string {
  let s = (label ?? "").trim();
  if (!s) return "—";
  s = s.split(/\s+[—–-]\s+/)[0].trim();
  s = s.replace(/\s+arm\b.*$/i, "").trim();
  const withNumber = s.match(/^(.*?\d+)(?=\D|$)/);
  return withNumber ? withNumber[1].trim() : s;
}
