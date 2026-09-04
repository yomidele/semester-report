import { useEffect, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRole } from "@/hooks/use-role";
import { CollegeSettings, useCollegeSettings } from "@/lib/college-settings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Settings — Super Admin" }] }),
  component: () => (
    <ProtectedAdmin>
      <Page />
    </ProtectedAdmin>
  ),
});

function Page() {
  const { isSuperAdmin, loading } = useRole();
  if (loading) return <Loader2 className="m-8 h-6 w-6 animate-spin text-primary" />;
  if (!isSuperAdmin) return <Navigate to="/dashboard" />;
  return <SettingsPage />;
}

function SettingsPage() {
  const { settings, isLoading } = useCollegeSettings();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CollegeSettings>(settings);
  const [socials, setSocials] = useState(JSON.stringify(settings.socials, null, 2));
  const [gradingScale, setGradingScale] = useState(JSON.stringify(settings.grading_scale, null, 2));

  useEffect(() => {
    setForm(settings);
    setSocials(JSON.stringify(settings.socials, null, 2));
    setGradingScale(JSON.stringify(settings.grading_scale, null, 2));
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      let parsedSocials: Record<string, string>;
      let parsedScale: CollegeSettings["grading_scale"];
      try {
        parsedSocials = JSON.parse(socials);
        parsedScale = JSON.parse(gradingScale);
      } catch {
        throw new Error("Socials and grading scale must contain valid JSON");
      }
      const values = {
        college_name: form.college_name.trim(), short_name: form.short_name.trim(), motto: form.motto,
        logo_url: form.logo_url, address: form.address, city: form.city, state: form.state,
        phone: form.phone, email: form.email, website: form.website, socials: parsedSocials,
        matric_format: form.matric_format.trim(), matric_seq_padding: form.matric_seq_padding,
        grading_scale: parsedScale, pass_mark: form.pass_mark, use_gpa: form.use_gpa,
        pin_settings: form.pin_settings, payment_settings: form.payment_settings,
      };
      const response = form.id
        ? await supabase.from("college_settings").update(values).eq("id", form.id)
        : await supabase.from("college_settings").insert(values);
      if (response.error) throw response.error;
    },
    onSuccess: () => {
      toast.success("College settings saved");
      queryClient.invalidateQueries({ queryKey: ["college-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const set = <K extends keyof CollegeSettings>(key: K, value: CollegeSettings[K]) => setForm((current) => ({ ...current, [key]: value }));
  const setPin = <K extends keyof CollegeSettings["pin_settings"]>(key: K, value: CollegeSettings["pin_settings"][K]) =>
    setForm((current) => ({ ...current, pin_settings: { ...current.pin_settings, [key]: value } }));
  const setPayment = <K extends keyof CollegeSettings["payment_settings"]>(key: K, value: CollegeSettings["payment_settings"][K]) =>
    setForm((current) => ({ ...current, payment_settings: { ...current.payment_settings, [key]: value } }));

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin text-primary" />;
  return (
    <div className="space-y-6">
      <div><h2 className="font-serif text-2xl font-bold">College Settings</h2><p className="text-sm text-muted-foreground">Manage the institution identity used throughout the portals.</p></div>
      <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <Card><CardHeader><CardTitle className="text-base">Identity and contact</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="College name" value={form.college_name} onChange={(value) => set("college_name", value)} />
          <Field label="Short name" value={form.short_name} onChange={(value) => set("short_name", value)} />
          <Field label="Motto" value={form.motto ?? ""} onChange={(value) => set("motto", value)} />
          <Field label="Logo URL" value={form.logo_url ?? ""} onChange={(value) => set("logo_url", value)} />
          <Field label="Address" value={form.address ?? ""} onChange={(value) => set("address", value)} />
          <Field label="City" value={form.city ?? ""} onChange={(value) => set("city", value)} />
          <Field label="State" value={form.state ?? ""} onChange={(value) => set("state", value)} />
          <Field label="Phone" value={form.phone ?? ""} onChange={(value) => set("phone", value)} />
          <Field label="Email" value={form.email ?? ""} onChange={(value) => set("email", value)} />
          <Field label="Website" value={form.website ?? ""} onChange={(value) => set("website", value)} />
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Academic configuration</CardTitle></CardHeader><CardContent className="space-y-4">
          <Field label="Matric format" value={form.matric_format} onChange={(value) => set("matric_format", value)} />
          <p className="text-xs text-muted-foreground">Use tokens such as {'{DEPT}'}, {'{YY}'} and {'{SEQ}'}.</p>
          <div className="grid gap-4 md:grid-cols-2"><Field label="Sequence padding" type="number" value={String(form.matric_seq_padding)} onChange={(value) => set("matric_seq_padding", Number(value))} /><Field label="Pass mark" type="number" value={String(form.pass_mark)} onChange={(value) => set("pass_mark", Number(value))} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.use_gpa} onChange={(event) => set("use_gpa", event.target.checked)} /> Use GPA calculations</label>
          <div><Label>Socials JSON</Label><Textarea rows={4} value={socials} onChange={(event) => setSocials(event.target.value)} /></div>
          <div><Label>Grading scale JSON</Label><Textarea rows={10} value={gradingScale} onChange={(event) => setGradingScale(event.target.value)} /></div>
        </CardContent></Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Result PIN pricing &amp; payment</CardTitle>
            <p className="text-xs text-muted-foreground">
              Controls what students pay for a Result Checking PIN and how long/many times a PIN can be used.
              The Paystack secret key is never entered here — it stays server-side as the{" "}
              <code>PAYSTACK_SECRET_KEY</code> environment variable.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field
              label={`Result PIN price (${form.pin_settings.currency})`}
              type="number"
              value={String(form.pin_settings.price)}
              onChange={(value) => setPin("price", Number(value))}
            />
            <Field
              label="Currency"
              value={form.pin_settings.currency}
              onChange={(value) => setPin("currency", value)}
            />
            <Field
              label="Maximum result views per PIN"
              type="number"
              value={String(form.pin_settings.max_views)}
              onChange={(value) => setPin("max_views", Number(value))}
            />
            <Field
              label="PIN expiry (days after purchase)"
              type="number"
              value={String(form.pin_settings.expiry_days)}
              onChange={(value) => setPin("expiry_days", Number(value))}
            />
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={form.payment_settings.paystack_enabled}
                onChange={(event) => setPayment("paystack_enabled", event.target.checked)}
              />
              Enable online Paystack payment for Result PINs
            </label>
            <Field
              label="Paystack public key"
              value={form.payment_settings.paystack_public_key}
              onChange={(value) => setPayment("paystack_public_key", value)}
            />
            <p className="text-xs text-muted-foreground md:col-span-2">
              If <code>PAYSTACK_SECRET_KEY</code> isn't set on the server, students see a message directing them to
              the registry for a manually-issued PIN instead — online purchase is disabled automatically, regardless
              of this toggle.
            </p>
          </CardContent>
        </Card>
        <Button type="submit" disabled={save.isPending}>{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save settings</Button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="space-y-1.5 text-sm font-medium"><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
