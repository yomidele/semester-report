import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NewsPost {
  id: string;
  title: string;
  slug: string;
  category: "news" | "event" | "announcement";
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  author_name: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
}

const PAGE_SIZE = 6;

export function usePublishedPosts(page: number) {
  return useQuery({
    queryKey: ["public", "news", page],
    staleTime: 30_000,
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from("news_posts")
        .select("*", { count: "exact" })
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { posts: (data ?? []) as NewsPost[], total: count ?? 0, pageSize: PAGE_SIZE };
    },
  });
}

export function useRecentPosts(limit = 3) {
  return useQuery({
    queryKey: ["public", "news", "recent", limit],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_posts")
        .select("*")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as NewsPost[];
    },
  });
}

export function usePostBySlug(slug: string) {
  return useQuery({
    queryKey: ["public", "news", "slug", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_posts")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      if (error) throw error;
      return data as NewsPost | null;
    },
  });
}

export function formatPostDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
