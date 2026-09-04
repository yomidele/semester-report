import { createFileRoute } from "@tanstack/react-router";
import { ProtectedFaculty } from "@/components/ProtectedFaculty";
import { TranscriptsPage } from "./transcripts";

export const Route = createFileRoute("/faculty/transcripts")({
  head: () => ({ meta: [{ title: "Faculty Transcripts — Kazaure College" }] }),
  component: () => (
    <ProtectedFaculty>
      <TranscriptsPage />
    </ProtectedFaculty>
  ),
});
