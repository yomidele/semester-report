import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedStudent } from "@/components/ProtectedStudent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/student/password")({
  head: () => ({ meta: [{ title: "Change Password — Kazaure College" }] }),
  component: () => <ProtectedStudent><PasswordPage /></ProtectedStudent>,
});

function PasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); if (password.length < 8) return toast.error("Password must be at least 8 characters"); if (password !== confirm) return toast.error("Passwords do not match"); setSaving(true); const { error } = await supabase.auth.updateUser({ password }); setSaving(false); if (error) toast.error(error.message); else { setPassword(""); setConfirm(""); toast.success("Password changed"); } }
  return <div className="max-w-xl"><Card className="tsu-shadow"><CardHeader><CardTitle className="font-serif text-2xl">Change password</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={submit}><label className="space-y-1.5 text-sm font-medium"><Label>New password</Label><Input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label className="space-y-1.5 text-sm font-medium"><Label>Confirm new password</Label><Input type="password" minLength={8} value={confirm} onChange={(event) => setConfirm(event.target.value)} required /></label><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Change password"}</Button></form></CardContent></Card></div>;
}
