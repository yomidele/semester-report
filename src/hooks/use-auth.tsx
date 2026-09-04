import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Every page that needs auth state used to call useAuthSession() directly,
// each mounting its OWN supabase.auth.onAuthStateChange listener. A guarded
// page typically called it twice on top of that (once directly, once again
// inside useRole()), so a single admin page could have 2+ independent
// listeners all reacting to the same events slightly out of step with each
// other. Combined with a token-refresh-triggered re-fetch bug in useRole,
// that produced the admin dashboard flicker. This provider makes there be
// exactly ONE subscription for the whole app; every useAuthSession() call
// now just reads from this shared context instead of subscribing itself.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const authEventVersion = useRef(0);

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      authEventVersion.current += 1;
      if (!mounted) return;
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted || authEventVersion.current > 0) return;
      setSession(data.session);
      setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export function useAuthSession(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthSession must be used within <AuthProvider> (mounted in src/routes/__root.tsx)");
  }
  return ctx;
}
