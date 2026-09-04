import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GradeBand {
  grade: string;
  min: number;
  point: number;
  remark: string;
}

export interface CollegeSettings {
  id: string;
  college_name: string;
  short_name: string;
  motto: string | null;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  socials: Record<string, string>;
  matric_format: string;
  matric_seq_padding: number;
  grading_scale: GradeBand[];
  pass_mark: number;
  use_gpa: boolean;
  pin_settings: PinSettings;
  payment_settings: PaymentSettings;
}

export interface PinSettings {
  price: number;
  currency: string;
  max_views: number;
  expiry_days: number;
}

export interface PaymentSettings {
  paystack_enabled: boolean;
  /** Public key only — the secret key lives server-side as PAYSTACK_SECRET_KEY and is never sent to the client. */
  paystack_public_key: string;
}

export const DEFAULT_PIN_SETTINGS: PinSettings = {
  price: 1000,
  currency: "NGN",
  max_views: 5,
  expiry_days: 30,
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  paystack_enabled: false,
  paystack_public_key: "",
};

export const DEFAULT_GRADING_SCALE: GradeBand[] = [
  { grade: "A", min: 70, point: 5, remark: "Excellent" },
  { grade: "B", min: 60, point: 4, remark: "Very Good" },
  { grade: "C", min: 50, point: 3, remark: "Good" },
  { grade: "D", min: 45, point: 2, remark: "Pass" },
  { grade: "E", min: 40, point: 1, remark: "Weak Pass" },
  { grade: "F", min: 0, point: 0, remark: "Fail" },
];

export const FALLBACK_SETTINGS: CollegeSettings = {
  id: "",
  college_name: "Kazaure College of Health Technology",
  short_name: "KCOHT",
  motto: "Knowledge, Service, Compassion",
  logo_url: null,
  address: null,
  city: null,
  state: null,
  phone: null,
  email: null,
  website: null,
  socials: {},
  matric_format: "{DEPT}/{YY}/{SEQ}",
  matric_seq_padding: 4,
  grading_scale: DEFAULT_GRADING_SCALE,
  pass_mark: 40,
  use_gpa: true,
  pin_settings: DEFAULT_PIN_SETTINGS,
  payment_settings: DEFAULT_PAYMENT_SETTINGS,
};

function normalize(row: Record<string, unknown> | null): CollegeSettings {
  if (!row) return FALLBACK_SETTINGS;
  const scale = Array.isArray(row["grading_scale"]) ? (row["grading_scale"] as GradeBand[]) : [];
  return {
    ...FALLBACK_SETTINGS,
    ...(row as unknown as CollegeSettings),
    socials: (row["socials"] as Record<string, string>) ?? {},
    grading_scale: scale.length ? [...scale].sort((a, b) => b.min - a.min) : DEFAULT_GRADING_SCALE,
    pin_settings: { ...DEFAULT_PIN_SETTINGS, ...(row["pin_settings"] as Partial<PinSettings> | null) },
    payment_settings: { ...DEFAULT_PAYMENT_SETTINGS, ...(row["payment_settings"] as Partial<PaymentSettings> | null) },
  };
}

export function useCollegeSettings() {
  const query = useQuery({
    queryKey: ["college-settings"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("college_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return normalize(data as Record<string, unknown> | null);
    },
  });
  return { settings: query.data ?? FALLBACK_SETTINGS, ...query };
}

/** Full college address on one line. */
export function formatAddress(s: CollegeSettings): string {
  return [s.address, s.city, s.state].filter(Boolean).join(", ");
}
