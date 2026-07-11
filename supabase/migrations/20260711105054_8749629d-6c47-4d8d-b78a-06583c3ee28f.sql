
-- Recreate view with security_invoker=true (owner's permissions no longer used)
DROP VIEW IF EXISTS public.public_stores;
CREATE VIEW public.public_stores
WITH (security_invoker = true) AS
SELECT
  id, store_uid, name,
  address_line, road, area, city, pincode,
  latitude, longitude,
  bw_price, color_price, one_pin_price, tape_price, spiral_price,
  qr_image_path
FROM public.stores;

-- Drop the SECURITY DEFINER RPCs that the client used to call directly.
-- Public store lookups now go through the stores-public edge function.
DROP FUNCTION IF EXISTS public.get_store_by_uid(text);
DROP FUNCTION IF EXISTS public.list_nearby_stores(double precision, double precision, integer);
