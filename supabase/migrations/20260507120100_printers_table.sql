-- Create printers table
CREATE TABLE public.printers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  printer_type printer_type NOT NULL,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Create index for store printers
CREATE INDEX idx_printers_store ON public.printers (store_id, printer_type);

-- Enable RLS for printers table
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for printers
CREATE POLICY "Store owners can view their printers" ON public.printers
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.stores WHERE stores.id = printers.store_id AND stores.owner_id = auth.uid())
  );

CREATE POLICY "Store owners can manage their printers" ON public.printers
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.stores WHERE stores.id = printers.store_id AND stores.owner_id = auth.uid())
  );

CREATE POLICY "Store owners can update their printers" ON public.printers
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.stores WHERE stores.id = printers.store_id AND stores.owner_id = auth.uid())
  );

CREATE POLICY "Store owners can delete their printers" ON public.printers
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.stores WHERE stores.id = printers.store_id AND stores.owner_id = auth.uid())
  );

-- Create trigger to enforce printer limits (max 6 color, 7 bw, 5 micro)
CREATE OR REPLACE FUNCTION check_printer_limits()
RETURNS TRIGGER AS $$
DECLARE
  color_count int;
  bw_count int;
  micro_count int;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE printer_type = 'color'),
    COUNT(*) FILTER (WHERE printer_type = 'bw'),
    COUNT(*) FILTER (WHERE printer_type = 'micro')
  INTO color_count, bw_count, micro_count
  FROM public.printers
  WHERE store_id = NEW.store_id AND is_active = true;

  IF NEW.printer_type = 'color' AND color_count >= 6 THEN
    RAISE EXCEPTION 'Maximum 6 color printers allowed per store';
  END IF;

  IF NEW.printer_type = 'bw' AND bw_count >= 7 THEN
    RAISE EXCEPTION 'Maximum 7 B&W printers allowed per store';
  END IF;

  IF NEW.printer_type = 'micro' AND micro_count >= 5 THEN
    RAISE EXCEPTION 'Maximum 5 micro printers allowed per store';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_printer_limits
BEFORE INSERT ON public.printers
FOR EACH ROW
EXECUTE FUNCTION check_printer_limits();
