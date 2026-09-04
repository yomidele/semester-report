import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface School {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
}

export interface Department {
  id: string;
  faculty_id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
}

export interface Programme {
  id: string;
  faculty_id: string;
  department_id: string;
  name: string;
  code: string;
  award: string;
  duration_years: number;
  uses_gpa: boolean;
  min_units: number;
  max_units: number;
  description: string | null;
  requirements: string | null;
  is_active: boolean;
}

export function useSchools() {
  return useQuery({
    queryKey: ["public", "schools"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faculties")
        .select("id, name, code, description, is_active")
        .order("name");
      if (error) throw error;
      return (data ?? []) as School[];
    },
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ["public", "departments"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, faculty_id, name, code, description, is_active")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Department[];
    },
  });
}

export function useProgrammes() {
  return useQuery({
    queryKey: ["public", "programmes"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programmes")
        .select(
          "id, faculty_id, department_id, name, code, award, duration_years, uses_gpa, min_units, max_units, description, requirements, is_active",
        )
        .order("name");
      if (error) throw error;
      return (data ?? []) as Programme[];
    },
  });
}

export function durationLabel(years: number): string {
  return `${years} ${years === 1 ? "year" : "years"}`;
}
