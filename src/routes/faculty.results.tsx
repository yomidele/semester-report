import { createFileRoute } from "@tanstack/react-router";
import { ProtectedFaculty } from "@/components/ProtectedFaculty";
import { ResultsViewPage } from "./results";

export const Route = createFileRoute("/faculty/results")({
  head: () => ({ meta: [{ title: "Faculty Results — Kazaure College" }] }),
  component: () => (
    <ProtectedFaculty>
      <ResultsViewPage />
    </ProtectedFaculty>
  ),
});
