
-- stores table
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  store_uid text NOT NULL UNIQUE,
  name text NOT NULL,
  phone text NOT NULL,
  address_line text,
  road text,
  area text,
  city text,
  pincode text,
  latitude numeric,
  longitude numeric,
  bw_price integer NOT NULL DEFAULT 2,
  color_price integer NOT NULL DEFAULT 10,
  one_pin_price integer NOT NULL DEFAULT 2,
  tape_price integer NOT NULL DEFAULT 15,
  spiral_price integer NOT NULL DEFAULT 30,
  printer_name text,
  qr_image_path text,
  whatsapp_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX stores_owner_user_id_idx ON public.stores(owner_user_id);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Owner full access
CREATE POLICY "Owner can view own store" ON public.stores FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id);
CREATE POLICY "Owner can insert own store" ON public.stores FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Owner can update own store" ON public.stores FOR UPDATE TO authenticated
  USING (auth.uid() = owner_user_id);

-- Public-safe view for customers (no phone/whatsapp/owner)
CREATE VIEW public.public_stores
WITH (security_invoker = true) AS
SELECT id, store_uid, name, address_line, road, area, city, pincode,
       latitude, longitude, bw_price, color_price,
       one_pin_price, tape_price, spiral_price, qr_image_path
FROM public.stores;

-- Allow any authenticated user to read the public view by exposing a permissive SELECT policy
-- on a thin wrapper: simplest path — add a permissive SELECT policy to stores limited to safe columns is not possible per-column,
-- so instead expose RLS-bypassing function for lookup by uid.

CREATE OR REPLACE FUNCTION public.get_store_by_uid(_uid text)
RETURNS TABLE (
  id uuid,
  store_uid text,
  name text,
  address_line text,
  road text,
  area text,
  city text,
  pincode text,
  latitude numeric,
  longitude numeric,
  bw_price integer,
  color_price integer,
  one_pin_price integer,
  tape_price integer,
  spiral_price integer,
  qr_image_path text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, store_uid, name, address_line, road, area, city, pincode,
         latitude, longitude, bw_price, color_price,
         one_pin_price, tape_price, spiral_price, qr_image_path
  FROM public.stores
  WHERE store_uid = upper(_uid)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_store_by_uid(text) TO authenticated, anon;

-- Validate store_uid format and update timestamp
CREATE OR REPLACE FUNCTION public.validate_store()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.store_uid !~ '^CR-[A-Z0-9]{8,16}$' THEN
    RAISE EXCEPTION 'Invalid store_uid format: %', NEW.store_uid;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_store
BEFORE INSERT OR UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.validate_store();

-- Storage bucket for QR images
INSERT INTO storage.buckets (id, name, public) VALUES ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read store assets" ON storage.objects FOR SELECT
  USING (bucket_id = 'store-assets');

CREATE POLICY "Owner upload store assets" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner update store assets" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'store-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner delete store assets" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'store-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
