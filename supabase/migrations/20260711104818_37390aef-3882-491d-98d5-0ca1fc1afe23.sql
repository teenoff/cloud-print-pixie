
-- 1. Add pages column to orders and recompute amount_paise server-side
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pages integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.recompute_order_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.stores%ROWTYPE;
  per_page int;
  bind_price int;
BEGIN
  IF NEW.pages IS NULL OR NEW.pages < 1 THEN
    RAISE EXCEPTION 'pages must be >= 1';
  END IF;
  IF NEW.pages > 5000 THEN
    RAISE EXCEPTION 'pages exceeds maximum';
  END IF;

  SELECT * INTO s FROM public.stores WHERE store_uid = NEW.store_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown store_uid %', NEW.store_uid;
  END IF;

  per_page := CASE NEW.color_mode
    WHEN 'bw' THEN s.bw_price
    WHEN 'color' THEN s.color_price
    WHEN 'micro' THEN s.micro_price
  END;
  bind_price := CASE NEW.binding
    WHEN 'one_pin' THEN s.one_pin_price
    WHEN 'tape' THEN s.tape_price
    WHEN 'spiral' THEN s.spiral_price
  END;

  -- Overwrite any client-supplied amount with the authoritative computation (in paise)
  NEW.amount_paise := (per_page * NEW.pages + bind_price) * NEW.copies * 100;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recompute_order_amount() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS recompute_order_amount_trg ON public.orders;
CREATE TRIGGER recompute_order_amount_trg
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.recompute_order_amount();

-- 2. Recreate public_stores view with additional safe columns; run as view owner
--    so authenticated/anon can browse all stores without a broad SELECT policy on stores.
DROP VIEW IF EXISTS public.public_stores;
CREATE VIEW public.public_stores
WITH (security_invoker = false) AS
SELECT
  id, store_uid, name,
  address_line, road, area, city, pincode,
  latitude, longitude,
  bw_price, color_price, micro_price,
  one_pin_price, tape_price, spiral_price,
  qr_image_path,
  (is_online AND last_seen_at IS NOT NULL AND last_seen_at > now() - interval '2 minutes') AS is_online,
  last_seen_at
FROM public.stores;

GRANT SELECT ON public.public_stores TO anon, authenticated;

-- 3. Convert SECURITY DEFINER functions to SECURITY INVOKER
DROP FUNCTION IF EXISTS public.get_store_by_uid(text);
CREATE OR REPLACE FUNCTION public.get_store_by_uid(_uid text)
RETURNS TABLE(id uuid, store_uid text, name text, address_line text, road text, area text, city text, pincode text, latitude numeric, longitude numeric, bw_price integer, color_price integer, micro_price integer, one_pin_price integer, tape_price integer, spiral_price integer, qr_image_path text, is_online boolean, last_seen_at timestamp with time zone)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT id, store_uid, name, address_line, road, area, city, pincode,
         latitude, longitude, bw_price, color_price, micro_price,
         one_pin_price, tape_price, spiral_price, qr_image_path,
         is_online, last_seen_at
  FROM public.public_stores
  WHERE store_uid = upper(_uid)
  LIMIT 1;
$$;

DROP FUNCTION IF EXISTS public.list_nearby_stores(double precision, double precision, integer);
CREATE OR REPLACE FUNCTION public.list_nearby_stores(_lat double precision, _lng double precision, _limit integer DEFAULT 20)
RETURNS TABLE(store_uid text, name text, address_line text, city text, latitude numeric, longitude numeric, distance_km double precision, is_online boolean, bw_price integer, color_price integer, micro_price integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
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
    s.is_online,
    s.bw_price, s.color_price, s.micro_price
  FROM public.public_stores s
  ORDER BY distance_km NULLS LAST
  LIMIT _limit;
$$;

CREATE OR REPLACE FUNCTION public.is_store_owner(_store_uid text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores
    WHERE store_uid = _store_uid AND owner_user_id = auth.uid()
  );
$$;

-- Grants (invoker functions still need EXECUTE)
GRANT EXECUTE ON FUNCTION public.get_store_by_uid(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_nearby_stores(double precision, double precision, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_store_owner(text) TO authenticated;
