
DELETE FROM public.orders;
UPDATE storage.buckets SET public = false WHERE id = 'print-files';

ALTER TABLE public.orders ADD COLUMN user_id uuid NOT NULL;

DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can read orders" ON public.orders;

CREATE POLICY "Users view own orders" ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own orders" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own print files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'print-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own print files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'print-files' AND auth.uid()::text = (storage.foldername(name))[1]);
