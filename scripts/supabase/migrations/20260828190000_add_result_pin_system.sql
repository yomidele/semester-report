-- Result PIN system: purchase, Paystack payment, PDF voucher, public result checking.
-- Integrates with existing students, academic_sessions, results, college_settings, audit_logs.

-- ── Payments ────────────────────────────────────────────────────────────────
CREATE TABLE public.result_pin_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.academic_sessions(id),
  semester text NOT NULL CHECK (semester IN ('First', 'Second')),
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  reference text NOT NULL UNIQUE,               -- our reference, sent to Paystack
  paystack_reference text,                       -- reference Paystack confirms back
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed', 'reversed')),
  verified_at timestamptz,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_result_pin_payments_reference ON public.result_pin_payments(reference);
CREATE INDEX idx_result_pin_payments_student ON public.result_pin_payments(student_id);

-- ── PINs ────────────────────────────────────────────────────────────────────
CREATE TABLE public.result_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.academic_sessions(id),
  semester text NOT NULL CHECK (semester IN ('First', 'Second')),
  payment_id uuid REFERENCES public.result_pin_payments(id),  -- null for admin-issued manual PINs
  pin_hash text NOT NULL,               -- sha256(pin + pepper), never the raw PIN
  pin_last4 text NOT NULL,              -- last 4 chars only, for admin lookup/support reference
  source text NOT NULL DEFAULT 'online' CHECK (source IN ('online', 'manual')),
  issued_by uuid REFERENCES auth.users(id),   -- admin user, for manually-issued PINs
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted', 'expired', 'disabled')),
  max_views integer NOT NULL DEFAULT 5,
  views_used integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  voucher_path text,                    -- storage path of the generated PDF voucher
  verification_number text UNIQUE,      -- set the first time a report card is generated from this PIN
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  last_used_at timestamptz
);

CREATE INDEX idx_result_pins_student_period ON public.result_pins(student_id, session_id, semester);
CREATE INDEX idx_result_pins_status ON public.result_pins(status);
CREATE UNIQUE INDEX idx_result_pins_payment ON public.result_pins(payment_id) WHERE payment_id IS NOT NULL;

-- ── Result report verification (QR code target) ────────────────────────────
CREATE TABLE public.report_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_number text NOT NULL UNIQUE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.academic_sessions(id),
  semester text NOT NULL CHECK (semester IN ('First', 'Second')),
  result_pin_id uuid REFERENCES public.result_pins(id),
  generated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Lock everything down to service-role only; all access goes through   ──
-- ── server functions, which authorize explicitly in application code.   ──
ALTER TABLE public.result_pin_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.result_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.result_pin_payments FROM anon, authenticated;
REVOKE ALL ON public.result_pins FROM anon, authenticated;
REVOKE ALL ON public.report_verifications FROM anon, authenticated;

-- ── Configurable pricing / Paystack public settings, using the existing  ──
-- ── college_settings.pin_settings / payment_settings JSON columns.       ──
UPDATE public.college_settings
SET pin_settings = COALESCE(pin_settings, '{}'::jsonb) || jsonb_build_object(
      'price', COALESCE(pin_settings->>'price', '1000')::numeric,
      'currency', COALESCE(pin_settings->>'currency', 'NGN'),
      'max_views', COALESCE((pin_settings->>'max_views')::int, 5),
      'expiry_days', COALESCE((pin_settings->>'expiry_days')::int, 30)
    ),
    payment_settings = COALESCE(payment_settings, '{}'::jsonb) || jsonb_build_object(
      'paystack_enabled', COALESCE((payment_settings->>'paystack_enabled')::boolean, false),
      'paystack_public_key', COALESCE(payment_settings->>'paystack_public_key', '')
    )
WHERE pin_settings IS NULL OR payment_settings IS NULL
   OR NOT (pin_settings ? 'price') OR NOT (payment_settings ? 'paystack_enabled');
