import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HeartPulse, Menu, X, Phone, Mail, MapPin, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCollegeSettings, formatAddress } from "@/lib/college-settings";
import { useAuthSession } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { LanguageProvider, useLanguage, useT, type DictKey } from "@/lib/i18n";
import { useTr } from "@/lib/content-translations";

// Browser-tab titles per public page. Route titles are set in English by the
// router, so the layout re-applies them in the visitor's language.
const PAGE_TITLE_KEYS: Record<string, DictKey> = {
  "/about": "title.about",
  "/schools": "title.schools",
  "/programmes": "title.programmes",
  "/departments": "title.departments",
  "/admissions": "title.admissions",
  "/apply": "title.apply",
  "/news": "title.news",
  "/contact": "title.contact",
  "/cds-project": "title.cds",
  "/check-result": "title.checkResult",
  "/result-pin/buy": "title.buyPin",
  "/result-pin/callback": "title.paymentConfirm",
};

const NAV = [
  { to: "/", labelKey: "layout.nav.home" },
  { to: "/about", labelKey: "layout.nav.about" },
  { to: "/schools", labelKey: "layout.nav.schools" },
  { to: "/departments", labelKey: "layout.nav.classes" },
  { to: "/programmes", labelKey: "layout.nav.subjects" },
  { to: "/admissions", labelKey: "layout.nav.admissions" },
  { to: "/news", labelKey: "layout.nav.news" },
  { to: "/check-result", labelKey: "layout.nav.checkResult" },
  { to: "/contact", labelKey: "layout.nav.contact" },
  { to: "/cds-project", labelKey: "layout.nav.cdsProject" },
] as const satisfies readonly { to: string; labelKey: DictKey }[];

function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLanguage();
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "en" ? "ha" : "en")}
      className={`inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary ${className}`}
      aria-label={t("layout.switchLanguage")}
    >
      <Languages className="h-3.5 w-3.5" />
      {lang === "en" ? t("layout.lang.switchToHausa") : t("layout.lang.switchToEnglish")}
    </button>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <PublicLayoutInner>{children}</PublicLayoutInner>
    </LanguageProvider>
  );
}

function PublicLayoutInner({ children }: { children: React.ReactNode }) {
  const { settings } = useCollegeSettings();
  const { session } = useAuthSession();
  const { roles } = useRole();
  const t = useT();
  const tr = useTr();
  const { pathname } = useLocation();
  const { lang } = useLanguage();
  useEffect(() => {
    const key = PAGE_TITLE_KEYS[pathname.replace(/\/$/, "") || "/"];
    if (!key) return;
    // Run after the router has applied its own (English) title for this page.
    const id = window.setTimeout(() => { document.title = t(key); }, 0);
    return () => window.clearTimeout(id);
  }, [pathname, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState(false);
  const address = formatAddress(settings);
  const metadata = session?.user.user_metadata as Record<string, unknown> | undefined;
  const accountName = (metadata?.["full_name"] as string | undefined) ?? (metadata?.["display_name"] as string | undefined) ?? session?.user.email?.split("@")[0] ?? t("layout.account");
  const accountImage = (metadata?.["avatar_url"] as string | undefined) ?? (metadata?.["picture"] as string | undefined);
  const accountTarget = roles.includes("super_admin")
      ? "/dashboard"
      : roles.includes("exam_officer")
        ? "/exam-officer/dashboard"
        : roles.includes("admission_officer")
          ? "/admission-officer/dashboard"
          : "/lecturer/dashboard";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="tsu-header-grad text-sidebar-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-xs md:px-6">
          <span className="flex items-center gap-4">
            {settings.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> {settings.phone}
              </span>
            )}
            {settings.email && (
              <span className="hidden items-center gap-1 sm:flex">
                <Mail className="h-3 w-3" /> {settings.email}
              </span>
            )}
          </span>
          <span className="text-accent">{tr(settings.motto)}</span>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-accent bg-primary text-primary-foreground">
              {settings.logo_url ? (
                <img src={settings.logo_url} alt={`${settings.college_name} logo`} className="h-full w-full object-cover" />
              ) : (
                <HeartPulse className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-serif text-sm font-bold uppercase leading-tight text-primary md:text-base">
                {settings.college_name}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">{settings.short_name}</p>
            </div>
          </Link>

          <nav className="ml-auto hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                activeProps={{ className: "bg-secondary text-primary" }}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                {t(n.labelKey)}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-2">
            <LanguageToggle className="hidden sm:inline-flex" />
            <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
              <Link to="/check-result">{t("layout.header.checkResult")}</Link>
            </Button>
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link to="/admissions">{t("layout.header.applyNow")}</Link>
            </Button>
            {session && (
              <Link
                to={accountTarget}
                aria-label={`Open ${accountName} account`}
                className="flex min-w-0 items-center gap-2 rounded-md p-1.5 text-foreground transition-colors hover:bg-secondary"
              >
                <Avatar className="h-8 w-8 border border-border">
                  <AvatarImage src={accountImage ?? undefined} alt={`${accountName} profile`} />
                  <AvatarFallback>{accountName.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="hidden max-w-28 truncate text-xs font-medium xl:inline">{accountName}</span>
              </Link>
            )}
            <button
              type="button"
              aria-label={t("layout.toggleMenu")}
              className="rounded-md p-2 text-foreground hover:bg-secondary lg:hidden"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="border-t border-border bg-card px-4 pb-3 lg:hidden">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary"
              >
                {t(n.labelKey)}
              </Link>
            ))}
            <div className="mt-2 px-3">
              <LanguageToggle />
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-16 tsu-header-grad text-sidebar-foreground">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-3 md:px-6">
          <div>
            <h2 className="font-serif text-lg font-bold uppercase">{settings.college_name}</h2>
            <p className="mt-2 text-sm text-sidebar-foreground/80">{tr(settings.motto)}</p>
            {address && (
              <p className="mt-3 flex items-start gap-2 text-sm text-sidebar-foreground/80">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> {address}
              </p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-accent">{t("layout.footer.quickLinks")}</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-sidebar-foreground/80">
              {NAV.slice(1).map((n) => (
                <li key={n.to}>
                  <Link to={n.to} className="hover:text-accent">
                    {t(n.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-accent">{t("layout.footer.portals")}</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-sidebar-foreground/80">
               <li><Link to="/lecturer/login" className="hover:text-accent">{t("layout.footer.teacherPortal")}</Link></li>
              <li><Link to="/exam-officer/login" className="hover:text-accent">{t("layout.footer.examOfficerPortal")}</Link></li>
              <li><Link to="/admission-officer/login" className="hover:text-accent">{t("layout.footer.admissionOfficerPortal")}</Link></li>
              <li><Link to="/login" className="hover:text-accent">{t("layout.footer.superAdminPortal")}</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-sidebar-foreground/15 py-3 text-center text-xs text-sidebar-foreground/70">
          © {new Date().getFullYear()} {settings.college_name}. {t("layout.footer.rights")}
          <br className="sm:hidden" />
          <span className="sm:ml-1">
            ·{" "}
            <Link to="/cds-project" className="hover:text-accent">
              {t("layout.footer.cdsLink")}
            </Link>{" "}
            — {t("layout.footer.cdsCredit")}
          </span>
        </div>
      </footer>
    </div>
  );
}
