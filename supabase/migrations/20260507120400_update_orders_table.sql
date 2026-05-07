-- Update orders table with new columns
ALTER TABLE public.orders ADD COLUMN print_type printer_type;
ALTER TABLE public.orders ADD COLUMN page_count integer;
ALTER TABLE public.orders ADD COLUMN price_per_page decimal(8,2);
ALTER TABLE public.orders ADD COLUMN total_price decimal(8,2);
ALTER TABLE public.orders ADD COLUMN store_id uuid REFERENCES public.stores(id);

-- Create index for store_id lookups
CREATE INDEX idx_orders_store ON public.orders (store_id);

-- Update RLS policies for orders to include store_id checks
DROP POLICY IF EXISTS "Users view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users insert own orders" ON public.orders;

CREATE POLICY "Users view own orders" ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own orders" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Keep existing storage policies intact
-- The file upload and download policies from previous migrations remain active
