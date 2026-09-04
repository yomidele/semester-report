import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { HeartPulse, Menu, X, Phone, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCollegeSettings, formatAddress } from "@/lib/college-settings";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/schools", label: "Schools" },
  { to: "/departments", label: "Departments" },
  { to: "/programmes", label: "Programmes" },
  { to: "/admissions", label: "Admissions" },
  { to: "/news", label: "News" },
  { to: "/check-result", label: "Check Result" },
  { to: "/contact", label: "Contact" },
] as const;

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { settings } = useCollegeSettings();
  const [open, setOpen] = useState(false);
  const address = formatAddress(settings);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="tsu-header-grad text-primary-foreground">
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
          <span className="text-accent">{settings.motto}</span>
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
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-2">
            <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
              <Link to="/check-result">Check Result</Link>
            </Button>
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link to="/admissions">Apply Now</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/student/login">Student Portal</Link>
            </Button>
            <button
              type="button"
              aria-label="Toggle menu"
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
                {n.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-16 tsu-header-grad text-primary-foreground">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-3 md:px-6">
          <div>
            <h2 className="font-serif text-lg font-bold uppercase">{settings.college_name}</h2>
            <p className="mt-2 text-sm text-primary-foreground/80">{settings.motto}</p>
            {address && (
              <p className="mt-3 flex items-start gap-2 text-sm text-primary-foreground/80">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> {address}
              </p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-accent">Quick Links</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-primary-foreground/80">
              {NAV.slice(1).map((n) => (
                <li key={n.to}>
                  <Link to={n.to} className="hover:text-accent">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-accent">Portals</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-primary-foreground/80">
              <li><Link to="/student/login" className="hover:text-accent">Student Portal</Link></li>
              <li><Link to="/lecturer/login" className="hover:text-accent">Lecturer Portal</Link></li>
              <li><Link to="/dept-admin/login" className="hover:text-accent">Department Admin</Link></li>
              <li><Link to="/faculty/login" className="hover:text-accent">School Admin</Link></li>
              <li><Link to="/login" className="hover:text-accent">Administration</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-primary-foreground/15 py-3 text-center text-xs text-primary-foreground/70">
          © {new Date().getFullYear()} {settings.college_name}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
