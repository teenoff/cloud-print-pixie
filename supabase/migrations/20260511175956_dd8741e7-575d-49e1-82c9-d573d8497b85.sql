
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS qr_expires_at timestamptz DEFAULT (now() + interval '5 minutes'),
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS refund_id text,
  ADD COLUMN IF NOT EXISTS refund_status text;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS auto_accept boolean NOT NULL DEFAULT false;

-- Update validate_order_options to allow rejected/refunded
CREATE OR REPLACE FUNCTION public.validate_order_options()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.binding NOT IN ('one_pin','tape','spiral') THEN
    RAISE EXCEPTION 'Invalid binding: %', NEW.binding;
  END IF;
  IF NEW.color_mode NOT IN ('bw','color','micro') THEN
    RAISE EXCEPTION 'Invalid color_mode: %', NEW.color_mode;
  END IF;
  IF NEW.copies < 1 OR NEW.copies > 120 THEN
    RAISE EXCEPTION 'copies must be between 1 and 120';
  END IF;
  IF NEW.amount_paise < 0 THEN
    RAISE EXCEPTION 'amount_paise cannot be negative';
  END IF;
  IF NEW.status NOT IN ('pending','paid','printing','done','failed','rejected','refunded') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$function$;

-- Auto-accept trigger
CREATE OR REPLACE FUNCTION public.handle_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _auto boolean;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    NEW.qr_expires_at := NULL;
    SELECT auto_accept INTO _auto FROM public.stores WHERE store_uid = NEW.store_uid;
    IF _auto THEN
      NEW.status := 'printing';
      NEW.accepted_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS orders_status_change ON public.orders;
CREATE TRIGGER orders_status_change
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_status_change();

-- Ensure orders are in realtime publication (idempotent)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
