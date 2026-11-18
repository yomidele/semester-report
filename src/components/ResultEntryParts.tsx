import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Shared pieces for the two results-entry screens (teacher: /lecturer/entry,
// admin & exam officer: /result-entry) so scores look and behave the same.

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-border bg-muted text-foreground" },
  returned: { label: "Returned", className: "border-destructive/30 bg-destructive/10 text-destructive" },
  submitted: { label: "Submitted", className: "border-warning/40 bg-warning/15 text-foreground" },
  approved: { label: "Approved", className: "border-primary-dark/30 bg-secondary text-foreground" },
  published: { label: "Published", className: "border-success/30 bg-success/15 text-success" },
};

export function ResultStatusBadge({ status, returned }: { status?: string | null; returned?: boolean }) {
  if (!status) {
    return (
      <span className="inline-flex items-center rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground">
        Not entered
      </span>
    );
  }
  const key = status === "draft" && returned ? "returned" : status;
  const style = STATUS_STYLE[key] ?? { label: status, className: "border-border bg-muted text-foreground" };
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold", style.className)}>
      {style.label}
    </span>
  );
}

type ScoreInputProps = Omit<React.ComponentProps<typeof Input>, "type" | "inputMode"> & {
  max: number;
  invalid?: boolean;
};

/**
 * A score box that is always wide and tall enough to read what's typed:
 * 16px text (so phones don't zoom), the numeric keypad on mobile, and no
 * spinner arrows eating into the space for the digits.
 */
export const ScoreInput = forwardRef<HTMLInputElement, ScoreInputProps>(
  ({ className, invalid, max, ...props }, ref) => (
    <Input
      ref={ref}
      type="number"
      inputMode="decimal"
      enterKeyHint="next"
      min={0}
      max={max}
      step="0.5"
      autoComplete="off"
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 min-w-[4.5rem] text-center text-base font-semibold tabular-nums md:h-10 md:text-base",
        invalid && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30",
        className,
      )}
      {...props}
    />
  ),
);
ScoreInput.displayName = "ScoreInput";
