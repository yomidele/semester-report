import { createFileRoute } from "@tanstack/react-router";
import { ProtectedSection } from "@/components/ProtectedSection";
import { StudentsPage } from "./students";

export const Route = createFileRoute("/faculty/students")({
  head: () => ({ meta: [{ title: "Section Students — School Portal" }] }),
  component: () => (
    <ProtectedSection>
      <StudentsPage />
    </ProtectedSection>
  ),
});
