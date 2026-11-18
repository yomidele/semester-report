import { useState } from "react";
import { Link, useLocation, useNavigate, type LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { LogOut, Menu } from "lucide-react";
import { TSUHeader } from "./TSUHeader";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// One layout shared by all five staff portals (Super Admin, Teacher / Form
// Master, Exam Officer, Admission Officer). Before this, each portal had its
// own copy of the same sidebar, and on phones and tablets that sidebar
// collapsed into a single sideways-scrolling strip — with the Super Admin's
// 25 links, most of the navigation was off-screen and easy to miss.
//
//   * Desktop (lg, 1024px+): sticky sidebar beside the page.
//   * Phone and tablet: a slim bar under the header with the current page
//     name and a "Menu" button that opens the full navigation in a drawer.

export type PortalNavItem = {
  to: LinkProps["to"];
  label: string;
  icon: LucideIcon;
};

export type PortalNavSection = {
  title?: string;
  items: readonly PortalNavItem[];
};

function isActive(pathname: string, to: string) {
  return pathname === to || (to !== "/" && pathname.startsWith(`${to}/`));
}

function NavList({
  sections,
  pathname,
  onNavigate,
}: {
  sections: readonly PortalNavSection[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {sections.map((section, i) => (
        <div key={section.title ?? i} className="flex flex-col gap-1">
          {section.title && section.items.length > 0 && (
            <div className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </div>
          )}
          {section.items.map(({ to, label, icon: Icon }) => {
            const active = isActive(pathname, String(to));
            return (
              <Link
                key={String(to)}
                to={to}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 leading-snug">{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function PortalShell({
  subtitle,
  sections,
  loginPath,
  footer,
  children,
}: {
  subtitle: string;
  sections: readonly PortalNavSection[];
  loginPath: LinkProps["to"];
  footer?: string;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const currentLabel =
    sections.flatMap((s) => s.items).find((item) => isActive(location.pathname, String(item.to)))?.label ?? subtitle;

  const handleLogout = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: loginPath });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TSUHeader subtitle={subtitle} />

      {/* Phone / tablet navigation bar */}
      <div className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2 sm:px-4">
          <span className="min-w-0 truncate text-sm font-semibold">{currentLabel}</span>
          <Button variant="outline" size="sm" className="h-10 shrink-0 gap-2" onClick={() => setMenuOpen(true)}>
            <Menu className="h-4 w-4" />
            Menu
          </Button>
        </div>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="flex w-[85vw] max-w-xs flex-col gap-0 p-0">
          <SheetHeader className="border-b border-border px-4 py-4 text-left">
            <SheetTitle className="font-serif text-base">{subtitle}</SheetTitle>
            <SheetDescription className="sr-only">Portal navigation</SheetDescription>
          </SheetHeader>
          <nav className="flex-1 overflow-y-auto p-2">
            <NavList sections={sections} pathname={location.pathname} onNavigate={() => setMenuOpen(false)} />
          </nav>
          <div className="border-t border-border p-3">
            <Button variant="outline" className="h-10 w-full" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-3 py-4 sm:px-4 md:py-6 lg:px-6">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <nav className="tsu-shadow sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col rounded-md border border-border bg-card p-2">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <NavList sections={sections} pathname={location.pathname} />
            </div>
            <div className="mt-2 border-t border-border pt-2">
              <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </div>
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {footer && (
        <footer className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {footer}
        </footer>
      )}
    </div>
  );
}
