import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StaffProfile {
  id: string;
  full_name: string;
  role_title: string;
  category: "head_teacher" | "vice_head_teacher" | "exams_officer" | "admission_officer" | "teacher" | "staff";
  bio: string | null;
  photo_url: string | null;
  display_order: number;
  is_published: boolean;
}

const CATEGORY_ORDER: Record<StaffProfile["category"], number> = {
  head_teacher: 0,
  vice_head_teacher: 1,
  exams_officer: 2,
  admission_officer: 3,
  teacher: 4,
  staff: 5,
};

// Every published staff member, in category-then-display-order sequence.
// Used for a full "meet the staff" style listing, if one is ever built.
export function usePublishedStaff() {
  return useQuery({
    queryKey: ["public", "staff-profiles"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("*")
        .eq("is_published", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as StaffProfile[];
      return rows.sort((a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] || a.display_order - b.display_order);
    },
  });
}

// Just the school's leadership: Head Teacher, Assistant Head Teacher, Exams
// Officer, Admission Officer, in that hierarchy, for the homepage's
// management board section. Deliberately excludes ordinary teachers and
// other staff, and caps the count so the homepage stays short.
const MANAGEMENT_CATEGORIES: StaffProfile["category"][] = ["head_teacher", "vice_head_teacher", "exams_officer", "admission_officer"];

export function useManagementBoard(limit = 8) {
  return useQuery({
    queryKey: ["public", "management-board", limit],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("*")
        .eq("is_published", true)
        .in("category", MANAGEMENT_CATEGORIES)
        .order("display_order", { ascending: true })
        .limit(limit);
      if (error) throw error;
      const rows = (data ?? []) as StaffProfile[];
      return rows.sort((a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] || a.display_order - b.display_order);
    },
  });
}

export function categoryLabel(c: StaffProfile["category"]): string {
  switch (c) {
    case "head_teacher": return "Head Teacher";
    case "vice_head_teacher": return "Assistant Head Teacher";
    case "exams_officer": return "Exams Officer";
    case "admission_officer": return "Admission Officer";
    case "teacher": return "Teacher";
    default: return "Staff";
  }
}
