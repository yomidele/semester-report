import { createFileRoute } from "@tanstack/react-router";
import { ProtectedSection } from "@/components/ProtectedSection";
import { Report CardsPage } from "./transcripts";

export const Route = createFileRoute("/faculty/transcripts")({
  head: () => ({ meta: [{ title: "Section Report Cards — School Portal" }] }),
  component: () => (
    <ProtectedSection>
      <Report CardsPage />
    </ProtectedSection>
  ),
});
