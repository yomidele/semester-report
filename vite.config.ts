import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// No nitro preset override here — @lovable.dev/vite-tanstack-config's default
// build target is Cloudflare Pages (that's what Lovable's own "Publish" button
// deploys to). The project previously had `nitro: { preset: "node-server" }`
// set here for a Railway deployment (see railway.json) — that preset builds a
// plain Node server bundle, which is NOT what Cloudflare Pages/Workers expects,
// and would break a Cloudflare deploy. If you go back to Railway later, restore
// that line; for Cloudflare, leave this block out entirely.
export default defineConfig({
  vite: {
    build: {
      outDir: 'dist',
    },
  },
});
