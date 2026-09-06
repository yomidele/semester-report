import { createFileRoute } from "@tanstack/react-router";
import { ProtectedSection } from "@/components/ProtectedSection";
import { SubjectsPage } from "./courses";

export const Route = createFileRoute("/faculty/courses")({
  head: () => ({ meta: [{ title: "Section Subjects — School Portal" }] }),
  component: () => (
    <ProtectedSection>
      <SubjectsPage />
    </ProtectedSection>
  ),
});
