import { HeartPulse } from "lucide-react";
import { useCollegeSettings } from "@/lib/college-settings";

/**
 * Institutional header used across every staff/student portal.
 * All branding comes from configurable college settings.
 */
export function CollegeHeader({ subtitle, caption }: { subtitle?: string; caption?: string }) {
  const { settings } = useCollegeSettings();
  return (
    <header className="tsu-header-grad text-primary-foreground">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 md:gap-4 md:px-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-accent bg-primary-foreground text-primary md:h-14 md:w-14">
          {settings.logo_url ? (
            <img src={settings.logo_url} alt={`${settings.college_name} logo`} className="h-full w-full object-cover" />
          ) : (
            <HeartPulse className="h-6 w-6 md:h-7 md:w-7" />
          )}
        </div>
        <div className="min-w-0">
          <h1 className="font-serif text-base font-bold uppercase leading-tight md:text-xl">
            {settings.college_name}
          </h1>
          <p className="text-xs text-accent md:text-sm">{caption ?? "Office of the Registrar — Academic Management Portal"}</p>
          {subtitle && <p className="mt-0.5 truncate text-xs text-primary-foreground/80">{subtitle}</p>}
        </div>
      </div>
    </header>
  );
}

/** Backwards-compatible alias kept so existing portal screens keep working. */
export const TSUHeader = CollegeHeader;
