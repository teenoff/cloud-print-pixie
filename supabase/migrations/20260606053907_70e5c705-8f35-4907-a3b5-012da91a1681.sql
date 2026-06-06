
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS print_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS print_max_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS print_failure_reason text,
  ADD COLUMN IF NOT EXISTS print_failed_at timestamptz;
