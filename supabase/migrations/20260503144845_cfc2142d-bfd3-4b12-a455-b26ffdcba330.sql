
-- Orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_uid TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- MVP: anyone can create / read orders (no auth yet)
CREATE POLICY "Anyone can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read orders"
  ON public.orders FOR SELECT
  USING (true);

-- Storage bucket for uploaded PDFs (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('print-files', 'print-files', true);

CREATE POLICY "Public can read print files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'print-files');

CREATE POLICY "Anyone can upload print files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'print-files');
