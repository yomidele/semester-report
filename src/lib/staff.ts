import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StaffProfile {
  id: string;
  full_name: string;
  role_title: string;
  category: "head_teacher" | "vice_head_teacher" | "teacher" | "staff";
  bio: string | null;
  photo_url: string | null;
  display_order: number;
  is_published: boolean;
}

const CATEGORY_ORDER: Record<StaffProfile["category"], number> = {
  head_teacher: 0,
  vice_head_teacher: 1,
  teacher: 2,
  staff: 3,
};

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

export function categoryLabel(c: StaffProfile["category"]): string {
  switch (c) {
    case "head_teacher": return "Head Teacher";
    case "vice_head_teacher": return "Vice Head Teacher";
    case "teacher": return "Teacher";
    default: return "Staff";
  }
}
