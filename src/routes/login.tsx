import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TSUHeader } from "@/components/TSUHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ensureDemoAdmin } from "@/lib/seed-admin.functions";
import { useAuthSession } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Super Admin Sign in — Kazaure College" }] }),
  component: LoginPage,
});

const DEMO_EMAIL = "admin@kazaure.demo";
const DEMO_PASSWORD = "demo1234";

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuthSession();
  const { isSuperAdmin, loading: roleLoading } = useRole();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [submitting, setSubmitting] = useState(false);

  // This is the ONLY place that navigates to /dashboard. It waits for auth
  // AND role to both finish loading and confirm isSuperAdmin before moving —
  // that's what actually proves the login succeeded, not just the password
  // check. handleSignIn below used to also navigate immediately on its own,
  // which raced against this and usually lost: it would jump to /dashboard
  // before the role was confirmed, ProtectedAdmin would see "not confirmed
  // yet," and bounce straight back to /login. Looked like signing in just
  // didn't do anything. Removed the duplicate navigate from handleSignIn so
  // this effect is the single source of truth for the redirect.
  useEffect(() => {
    if (!authLoading && !roleLoading && session && isSuperAdmin) navigate({ to: "/dashboard" });
  }, [authLoading, roleLoading, session, isSuperAdmin, navigate]);

  // Ensure demo admin exists on page load
  useEffect(() => {
    ensureDemoAdmin().catch((e) => console.error("seed admin failed", e));
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Attempt to seed (idempotent) before signing in to handle first-ever load
      await ensureDemoAdmin();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Welcome back, Admin");
      // No navigate() here on purpose — the useEffect above handles the
      // redirect once session + role are both actually confirmed.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TSUHeader />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md tsu-shadow">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Super Admin Sign In</CardTitle>
            <CardDescription>University-wide administrator portal. Demo credentials are pre-filled.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</> : "Sign In"}
              </Button>
              <p className="rounded-md bg-secondary p-3 text-xs text-secondary-foreground">
                <strong>Demo account:</strong> {DEMO_EMAIL} / {DEMO_PASSWORD}
              </p>
              <div className="flex justify-between text-xs text-muted-foreground">
                <Link to="/faculty/login" className="hover:underline">Faculty Admin →</Link>
                <Link to="/student/login" className="hover:underline">Student →</Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
