import { createFileRoute } from "@tanstack/react-router";
import { ProtectedSection } from "@/components/ProtectedSection";
import { ResultsEntryGrid } from "@/components/ResultsEntryGrid";

export const Route = createFileRoute("/faculty/result-entry")({
  head: () => ({ meta: [{ title: "Section Result Entry — School Portal" }] }),
  component: () => (
    <ProtectedSection>
      <div className="p-2 md:p-6">
        <ResultsEntryGrid />
      </div>
    </ProtectedSection>
  ),
});
