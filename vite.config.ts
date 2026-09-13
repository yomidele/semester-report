import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Switched from the Cloudflare Pages default to Vercel's Nitro preset.
// Cloudflare Pages was Lovable's own "Publish" button target; now that this
// project is moving off Lovable and deploying to Vercel directly, it needs
// Nitro to emit a Vercel-compatible server (Build Output API v3) so that
// TanStack Start server functions (enrollStudent, createExamOfficer,
// createFacultyAdmin, etc.) keep running server-side with the service-role
// key. Without this, Vercel would only get the static client bundle and
// every one of those server functions would 404 in production.
//
// If you ever go back to Railway, restore `nitro: { preset: "node-server" }`
// (see railway.json). If you go back to Cloudflare Pages, remove the
// `nitro` block entirely.
export default defineConfig({
  vite: {
    build: {
      outDir: 'dist',
    },
  },
  nitro: {
    preset: "vercel",
  },
});
