
-- Orders: add columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS printed_at timestamptz;

-- Stores: add agent token
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS agent_token text;

UPDATE public.stores SET agent_token = encode(gen_random_bytes(24), 'hex') WHERE agent_token IS NULL;
ALTER TABLE public.stores ALTER COLUMN agent_token SET NOT NULL;
ALTER TABLE public.stores ALTER COLUMN agent_token SET DEFAULT encode(gen_random_bytes(24), 'hex');
CREATE UNIQUE INDEX IF NOT EXISTS stores_agent_token_idx ON public.stores(agent_token);

-- Update validate_order_options to allow new statuses
CREATE OR REPLACE FUNCTION public.validate_order_options()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
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
  IF NEW.status NOT IN ('pending','paid','printing','done','failed') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_order_options_trg ON public.orders;
CREATE TRIGGER validate_order_options_trg
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_options();

-- Helper: is current user the owner of this store_uid?
CREATE OR REPLACE FUNCTION public.is_store_owner(_store_uid text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores
    WHERE store_uid = _store_uid AND owner_user_id = auth.uid()
  );
$$;

-- Store owner can view + update orders for their store
DROP POLICY IF EXISTS "Store owner views store orders" ON public.orders;
CREATE POLICY "Store owner views store orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (public.is_store_owner(store_uid));

DROP POLICY IF EXISTS "Store owner updates store orders" ON public.orders;
CREATE POLICY "Store owner updates store orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.is_store_owner(store_uid));

-- Realtime
ALTER TABLE public.orders REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
