ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS binding text NOT NULL DEFAULT 'one_pin',
  ADD COLUMN IF NOT EXISTS copies integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS color_mode text NOT NULL DEFAULT 'bw',
  ADD COLUMN IF NOT EXISTS amount_paise integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.validate_order_options()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.binding NOT IN ('one_pin','tape','spiral') THEN
    RAISE EXCEPTION 'Invalid binding: %', NEW.binding;
  END IF;
  IF NEW.color_mode NOT IN ('bw','color') THEN
    RAISE EXCEPTION 'Invalid color_mode: %', NEW.color_mode;
  END IF;
  IF NEW.copies < 1 OR NEW.copies > 120 THEN
    RAISE EXCEPTION 'copies must be between 1 and 120';
  END IF;
  IF NEW.amount_paise < 0 THEN
    RAISE EXCEPTION 'amount_paise cannot be negative';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_order_options_trg ON public.orders;
CREATE TRIGGER validate_order_options_trg
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.validate_order_options();