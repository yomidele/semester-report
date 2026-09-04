import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ChevronLeft, Loader2 } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { usePostBySlug, formatPostDate } from "@/lib/news";

export const Route = createFileRoute("/news/$slug")({
  head: () => ({ meta: [{ title: "News — College" }] }),
  component: NewsPostPage,
});

function NewsPostPage() {
  const { slug } = Route.useParams();
  const { data: post, isLoading } = usePostBySlug(slug);

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </PublicLayout>
    );
  }

  if (!post) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-2xl px-4 py-24 text-center">
          <h1 className="font-serif text-2xl font-bold text-foreground">Post not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This post may have been removed or unpublished.</p>
          <Button asChild className="mt-6">
            <Link to="/news">Back to News</Link>
          </Button>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <article>
        {post.cover_image_url && (
          <div className="h-72 w-full overflow-hidden md:h-96">
            <img src={post.cover_image_url} alt={post.title} className="h-full w-full object-cover" />
          </div>
        )}
        <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
          <Link to="/news" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            <ChevronLeft className="h-4 w-4" /> Back to News
          </Link>
          <h1 className="mt-4 font-serif text-3xl font-bold leading-tight text-foreground md:text-4xl">{post.title}</h1>
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatPostDate(post.published_at)}
            </span>
            {post.author_name && <span>By {post.author_name}</span>}
          </div>
          <div className="prose prose-sm mt-8 max-w-none whitespace-pre-line leading-relaxed text-foreground/90">
            {post.content}
          </div>
        </div>
      </article>
    </PublicLayout>
  );
}
