-- Create pricing table
CREATE TABLE public.pricing (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  printer_type printer_type NOT NULL,
  price_per_page decimal(8,2) NOT NULL CHECK (price_per_page > 0),
  currency text DEFAULT 'INR',
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  UNIQUE(store_id, printer_type)
);

-- Create index for pricing lookups
CREATE INDEX idx_pricing_store ON public.pricing (store_id);

-- Enable RLS for pricing table
ALTER TABLE public.pricing ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pricing
CREATE POLICY "Everyone can view active store pricing" ON public.pricing
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.stores WHERE stores.id = pricing.store_id AND stores.is_active = true)
  );

CREATE POLICY "Store owners can manage their pricing" ON public.pricing
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.stores WHERE stores.id = pricing.store_id AND stores.owner_id = auth.uid())
  );

CREATE POLICY "Store owners can update their pricing" ON public.pricing
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.stores WHERE stores.id = pricing.store_id AND stores.owner_id = auth.uid())
  );

CREATE POLICY "Store owners can delete their pricing" ON public.pricing
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.stores WHERE stores.id = pricing.store_id AND stores.owner_id = auth.uid())
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pricing_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pricing_timestamp
BEFORE UPDATE ON public.pricing
FOR EACH ROW
EXECUTE FUNCTION update_pricing_timestamp();
