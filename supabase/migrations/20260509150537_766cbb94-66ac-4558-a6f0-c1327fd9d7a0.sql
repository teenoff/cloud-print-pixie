
-- 1. Stores: presence + micro price + new UID regex
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS micro_price integer NOT NULL DEFAULT 5;

CREATE OR REPLACE FUNCTION public.validate_store()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.store_uid !~ '^[A-Z]{2,4}[0-9]{4,14}$' OR length(NEW.store_uid) > 18 OR length(NEW.store_uid) < 6 THEN
    RAISE EXCEPTION 'Invalid store_uid format: % (expected 2-4 letters then 4-14 digits, total 6-18)', NEW.store_uid;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_store_tg ON public.stores;
CREATE TRIGGER validate_store_tg BEFORE INSERT OR UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.validate_store();

-- 2. Update get_store_by_uid to return new fields
DROP FUNCTION IF EXISTS public.get_store_by_uid(text);
CREATE OR REPLACE FUNCTION public.get_store_by_uid(_uid text)
RETURNS TABLE(id uuid, store_uid text, name text, address_line text, road text, area text, city text, pincode text, latitude numeric, longitude numeric, bw_price integer, color_price integer, micro_price integer, one_pin_price integer, tape_price integer, spiral_price integer, qr_image_path text, is_online boolean, last_seen_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, store_uid, name, address_line, road, area, city, pincode,
         latitude, longitude, bw_price, color_price, micro_price,
         one_pin_price, tape_price, spiral_price, qr_image_path,
         is_online AND (last_seen_at IS NOT NULL AND last_seen_at > now() - interval '2 minutes') AS is_online,
         last_seen_at
  FROM public.stores
  WHERE store_uid = upper(_uid)
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_store_by_uid(text) TO anon, authenticated;

-- 3. Nearby stores (haversine, no PostGIS)
CREATE OR REPLACE FUNCTION public.list_nearby_stores(_lat double precision, _lng double precision, _limit int DEFAULT 20)
RETURNS TABLE(store_uid text, name text, address_line text, city text, latitude numeric, longitude numeric, distance_km double precision, is_online boolean, bw_price integer, color_price integer, micro_price integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.store_uid, s.name, s.address_line, s.city, s.latitude, s.longitude,
    CASE WHEN s.latitude IS NULL OR s.longitude IS NULL THEN NULL ELSE
      6371 * acos(
        greatest(-1, least(1,
          cos(radians(_lat)) * cos(radians(s.latitude::double precision)) *
          cos(radians(s.longitude::double precision) - radians(_lng)) +
          sin(radians(_lat)) * sin(radians(s.latitude::double precision))
        ))
      )
    END AS distance_km,
    (s.is_online AND s.last_seen_at IS NOT NULL AND s.last_seen_at > now() - interval '2 minutes') AS is_online,
    s.bw_price, s.color_price, s.micro_price
  FROM public.stores s
  ORDER BY distance_km NULLS LAST
  LIMIT _limit;
$$;
GRANT EXECUTE ON FUNCTION public.list_nearby_stores(double precision, double precision, int) TO anon, authenticated;

-- 4. Re-grant is_store_owner
GRANT EXECUTE ON FUNCTION public.is_store_owner(text) TO anon, authenticated;

-- 5. Allow micro color_mode
CREATE OR REPLACE FUNCTION public.validate_order_options()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
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
  IF NEW.status NOT IN ('pending','paid','printing','done','failed') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_order_options_tg ON public.orders;
CREATE TRIGGER validate_order_options_tg BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.validate_order_options();

-- 6. store_printers
CREATE TABLE IF NOT EXISTS public.store_printers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('color','bw','micro')),
  name text NOT NULL,
  connection text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_printers_store_idx ON public.store_printers(store_id);

ALTER TABLE public.store_printers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner views own printers" ON public.store_printers FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_user_id = auth.uid()));

CREATE POLICY "Owner inserts own printers" ON public.store_printers FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_user_id = auth.uid()));

CREATE POLICY "Owner updates own printers" ON public.store_printers FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_user_id = auth.uid()));

CREATE POLICY "Owner deletes own printers" ON public.store_printers FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.enforce_printer_limits()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE c int; cap int;
BEGIN
  cap := CASE NEW.kind WHEN 'color' THEN 6 WHEN 'bw' THEN 7 WHEN 'micro' THEN 5 END;
  SELECT count(*) INTO c FROM public.store_printers
   WHERE store_id = NEW.store_id AND kind = NEW.kind AND id <> COALESCE(NEW.id, gen_random_uuid());
  IF c >= cap THEN
    RAISE EXCEPTION 'Printer limit reached for kind %: max %', NEW.kind, cap;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS enforce_printer_limits_tg ON public.store_printers;
CREATE TRIGGER enforce_printer_limits_tg BEFORE INSERT ON public.store_printers
FOR EACH ROW EXECUTE FUNCTION public.enforce_printer_limits();
