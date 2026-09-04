import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, Loader2, Newspaper } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePublishedPosts, formatPostDate } from "@/lib/news";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "News & Events" },
      { name: "description", content: "Latest news, admissions notices and events from the college." },
    ],
  }),
  component: NewsPage,
});

const CATEGORY_LABEL: Record<string, string> = {
  news: "News",
  event: "Event",
  announcement: "Announcement",
};

function NewsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = usePublishedPosts(page);
  const posts = data?.posts ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <PublicLayout>
      <div className="tsu-header-grad py-12 text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h1 className="font-serif text-3xl font-bold md:text-4xl">News &amp; Events</h1>
          <p className="mt-2 max-w-2xl text-sm text-primary-foreground/80">
            Admission notices, campus updates and events from across the college.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-12 md:px-6">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : posts.length === 0 ? (
          <Card className="tsu-shadow border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Newspaper className="h-10 w-10 text-muted-foreground" />
              <p className="font-serif text-xl font-semibold text-foreground">No posts yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Check back soon — admissions notices and campus news will appear here as they're published.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {posts.map((post) => (
              <Card key={post.id} className="overflow-hidden border-border tsu-shadow transition-shadow hover:shadow-md">
                {post.cover_image_url && (
                  <Link to="/news/$slug" params={{ slug: post.slug }}>
                    <img src={post.cover_image_url} alt={post.title} className="h-56 w-full object-cover" />
                  </Link>
                )}
                <CardContent className="space-y-3 p-6">
                  <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-foreground">
                    {CATEGORY_LABEL[post.category] ?? post.category}
                  </span>
                  <Link to="/news/$slug" params={{ slug: post.slug }}>
                    <h2 className="font-serif text-2xl font-bold leading-tight text-foreground hover:text-primary">
                      {post.title}
                    </h2>
                  </Link>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatPostDate(post.published_at)}
                  </p>
                  {post.excerpt && <p className="text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>}
                  <Button asChild size="sm" className="mt-2">
                    <Link to="/news/$slug" params={{ slug: post.slug }}>
                      Read More
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-10 flex justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`h-9 w-9 rounded-md border text-sm font-medium transition-colors ${
                  n === page
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-accent"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
