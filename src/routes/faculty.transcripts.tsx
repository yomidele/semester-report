import { createFileRoute } from "@tanstack/react-router";
import { ProtectedSection } from "@/components/ProtectedSection";
import { ReportCardsPage } from "./transcripts";

export const Route = createFileRoute("/faculty/transcripts")({
  head: () => ({ meta: [{ title: "Section Report Cards — School Portal" }] }),
  component: () => (
    <ProtectedSection>
      <ReportCardsPage />
    </ProtectedSection>
  ),
});
