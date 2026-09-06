import { createFileRoute } from "@tanstack/react-router";
import { ProtectedSection } from "@/components/ProtectedSection";
import { ResultsViewPage } from "./results";

export const Route = createFileRoute("/faculty/results")({
  head: () => ({ meta: [{ title: "Section Results — School Portal" }] }),
  component: () => (
    <ProtectedSection>
      <ResultsViewPage />
    </ProtectedSection>
  ),
});
