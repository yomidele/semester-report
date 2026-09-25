import { useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { useRole } from "@/hooks/use-role";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Trash2, Pencil, Plus, User } from "lucide-react";
import type { StaffProfile } from "@/lib/staff";

export const Route = createFileRoute("/admin/staff-profiles")({
  head: () => ({ meta: [{ title: "School Administration — Super Admin" }] }),
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
  return <StaffAdminPage />;
}

const emptyForm = {
  full_name: "",
  role_title: "",
  category: "teacher" as StaffProfile["category"],
  bio: "",
  photo_url: "",
  display_order: 0,
  is_published: true,
};

function StaffAdminPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const staffQ = useQuery({
    queryKey: ["admin", "staff-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_profiles").select("*").order("category").order("display_order");
      if (error) throw error;
      return data as StaffProfile[];
    },
  });

  const uploadPhoto = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("staff-photos").upload(path, file, { upsert: true });
    if (error) {
      // "Bucket not found" means the storage bucket itself was never created
      // in this Supabase project — the staff_profiles table migration
      // creates it, but if that migration wasn't applied to this project
      // (common right after cloning/deploying), the bucket is simply
      // missing. Give a message that points at the actual fix instead of
      // the raw Supabase error.
      if (/bucket not found/i.test(error.message)) {
        throw new Error(
          "Photo upload failed: the \"staff-photos\" storage bucket doesn't exist yet in this Supabase project. " +
          "Run the pending database migrations (supabase db push), or open the Supabase SQL Editor and run the " +
          "storage.buckets insert from supabase/migrations/20260913110000_staff_profiles_directory.sql."
        );
      }
      throw new Error(`Photo upload failed: ${error.message}`);
    }
    return supabase.storage.from("staff-photos").getPublicUrl(path).data.publicUrl;
  };

  const save = useMutation({
    mutationFn: async () => {
      let photo_url = form.photo_url.trim() || null;
      if (photoFile) {
        setUploading(true);
        try {
          photo_url = await uploadPhoto(photoFile);
        } finally {
          setUploading(false);
        }
      }
      const payload = {
        full_name: form.full_name.trim(),
        role_title: form.role_title.trim(),
        category: form.category,
        bio: form.bio.trim() || null,
        photo_url,
        display_order: form.display_order,
        is_published: form.is_published,
      };
      if (editingId) {
        const { error } = await supabase.from("staff_profiles").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("staff_profiles").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Profile updated" : "Profile added");
      setForm(emptyForm);
      setPhotoFile(null);
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["admin", "staff-profiles"] });
      qc.invalidateQueries({ queryKey: ["public", "staff-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["admin", "staff-profiles"] });
      qc.invalidateQueries({ queryKey: ["public", "staff-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startEdit(p: StaffProfile) {
    setEditingId(p.id);
    setPhotoFile(null);
    setForm({
      full_name: p.full_name,
      role_title: p.role_title,
      category: p.category,
      bio: p.bio ?? "",
      photo_url: p.photo_url ?? "",
      display_order: p.display_order,
      is_published: p.is_published,
    });
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">School Administration</h1>
        <p className="text-sm text-muted-foreground">
          Add the Head Teacher, Vice Head Teacher, and other teachers/staff. Published profiles appear on the homepage.
        </p>
      </div>

      <Card className="tsu-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-lg">
            {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? "Edit profile" : "Add a staff member"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <label className="space-y-1.5 text-sm font-medium">
              <Label>Full name</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              <Label>Role / title shown on the site</Label>
              <Input
                value={form.role_title}
                onChange={(e) => setForm({ ...form, role_title: e.target.value })}
                placeholder="e.g. Head Teacher (Principal)"
                required
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              <Label>Category (controls sort order)</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as StaffProfile["category"] })}
              >
                <option value="head_teacher">Head Teacher</option>
                <option value="vice_head_teacher">Assistant Head Teacher</option>
                <option value="exams_officer">Exams Officer</option>
                <option value="admission_officer">Admission Officer</option>
                <option value="teacher">Teacher</option>
                <option value="staff">Other Staff</option>
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              <Label>Display order (lower shows first, within a category)</Label>
              <Input
                type="number"
                value={form.display_order}
                onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium md:col-span-2">
              <Label>Photo</Label>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border">
                  <AvatarImage src={photoFile ? URL.createObjectURL(photoFile) : form.photo_url || undefined} className="object-cover" />
                  <AvatarFallback><User className="h-6 w-6 text-muted-foreground" /></AvatarFallback>
                </Avatar>
                <Input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} className="max-w-xs" />
              </div>
            </label>
            <label className="space-y-1.5 text-sm font-medium md:col-span-2">
              <Label>Short bio (optional)</Label>
              <Textarea rows={2} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
              Show on homepage
            </label>
            <div className="flex items-end gap-2 md:col-span-2">
              <Button type="submit" disabled={save.isPending || uploading}>
                {(save.isPending || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? "Save changes" : "Add to team"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); setPhotoFile(null); }}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="tsu-shadow">
        <CardHeader><CardTitle className="font-serif text-lg">Current team</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {staffQ.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (staffQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No one added yet.</p>
          ) : (
            (staffQ.data ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={p.photo_url ?? undefined} className="object-cover" />
                    <AvatarFallback><User className="h-4 w-4 text-muted-foreground" /></AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground">{p.role_title} · {p.is_published ? "Visible" : "Hidden"}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => remove.mutate(p.id)} disabled={remove.isPending}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
