-- The PIN voucher/report system (src/lib/result-pin.functions.ts) uploads
-- generated voucher PDFs to a "result-pin-vouchers" bucket via supabaseAdmin
-- (service role), then hands the student a short-lived signed URL. The
-- bucket was never created, so every upload would fail with "Bucket not
-- found". This migration creates it as private and locks it down the same
-- way the result_pins tables are locked down: no direct anon/authenticated
-- access at all — every read/write goes through a server function that
-- authorizes explicitly (ownership check on student_id, admin role check).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('result-pin-vouchers', 'result-pin-vouchers', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Deliberately no storage.objects policies are added for this bucket.
-- storage.objects has RLS enabled by default, so with zero matching
-- policies, anon/authenticated clients get no access at all — the only
-- path in or out is supabaseAdmin (the service-role key), which bypasses
-- RLS entirely and is only ever called from server functions that already
-- authorize the request (ownership check against student_id, or an admin
-- role check). Do NOT add a permissive policy here "to be safe" — a
-- broad policy on storage.objects can accidentally widen access to
-- other, unrelated buckets.
