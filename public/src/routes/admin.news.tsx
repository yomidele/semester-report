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
import { toast } from "sonner";
import { Loader2, Trash2, Pencil, Plus } from "lucide-react";
import { slugify, formatPostDate, type NewsPost } from "@/lib/news";

export const Route = createFileRoute("/admin/news")({
  head: () => ({ meta: [{ title: "News & Events — Super Admin" }] }),
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
  return <NewsAdminPage />;
}

const emptyForm = {
  id: "",
  title: "",
  category: "news",
  excerpt: "",
  content: "",
  cover_image_url: "",
  author_name: "",
  is_published: false,
};

function NewsAdminPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const postsQ = useQuery({
    queryKey: ["admin", "news"],
    queryFn: async () => {
      const { data, error } = await supabase.from("news_posts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as NewsPost[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const slug = slugify(form.title);
      const payload = {
        title: form.title.trim(),
        slug,
        category: form.category,
        excerpt: form.excerpt.trim() || null,
        content: form.content.trim(),
        cover_image_url: form.cover_image_url.trim() || null,
        author_name: form.author_name.trim() || null,
        is_published: form.is_published,
        published_at: form.is_published ? new Date().toISOString() : null,
      };
      if (editingId) {
        const { error } = await supabase.from("news_posts").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("news_posts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Post updated" : "Post created");
      setForm(emptyForm);
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["admin", "news"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("news_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post deleted");
      qc.invalidateQueries({ queryKey: ["admin", "news"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startEdit(post: NewsPost) {
    setEditingId(post.id);
    setForm({
      id: post.id,
      title: post.title,
      category: post.category,
      excerpt: post.excerpt ?? "",
      content: post.content,
      cover_image_url: post.cover_image_url ?? "",
      author_name: post.author_name ?? "",
      is_published: post.is_published,
    });
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">News &amp; Events</h1>
        <p className="text-sm text-muted-foreground">Publish admissions notices, campus news and events to the public site.</p>
      </div>

      <Card className="tsu-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-lg">
            {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? "Edit post" : "New post"}
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
            <label className="space-y-1.5 text-sm font-medium md:col-span-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              <Label>Category</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="news">News</option>
                <option value="event">Event</option>
                <option value="announcement">Announcement</option>
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              <Label>Author name</Label>
              <Input value={form.author_name} onChange={(e) => setForm({ ...form, author_name: e.target.value })} />
            </label>
            <label className="space-y-1.5 text-sm font-medium md:col-span-2">
              <Label>Cover image URL</Label>
              <Input
                value={form.cover_image_url}
                onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
                placeholder="https://..."
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium md:col-span-2">
              <Label>Excerpt (shown on the listing page)</Label>
              <Textarea rows={2} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
            </label>
            <label className="space-y-1.5 text-sm font-medium md:col-span-2">
              <Label>Content</Label>
              <Textarea rows={8} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
              />
              Publish immediately
            </label>
            <div className="flex items-end gap-2 md:col-span-2">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? "Save changes" : "Create post"}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="tsu-shadow">
        <CardHeader>
          <CardTitle className="font-serif text-lg">All posts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {postsQ.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (postsQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts yet. Create your first one above.</p>
          ) : (
            (postsQ.data ?? []).map((post) => (
              <div key={post.id} className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{post.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {post.is_published ? `Published ${formatPostDate(post.published_at)}` : "Draft"} · {post.category}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(post)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => remove.mutate(post.id)} disabled={remove.isPending}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
