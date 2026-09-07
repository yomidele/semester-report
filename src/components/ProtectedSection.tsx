import type { ReactNode } from "react";
import { ProtectedFaculty } from "./ProtectedFaculty";

export function ProtectedSection({ children }: { children: ReactNode }) {
  return <ProtectedFaculty>{children}</ProtectedFaculty>;
}
