
-- 1. Lock down SECURITY DEFINER functions: revoke from PUBLIC, grant to authenticated only
REVOKE EXECUTE ON FUNCTION public.is_store_owner(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_store_by_uid(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_nearby_stores(double precision, double precision, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_store_owner(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_by_uid(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_nearby_stores(double precision, double precision, integer) TO authenticated;

-- 2. print-files: add DELETE and UPDATE policies scoped to file owner
CREATE POLICY "Users delete own print files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'print-files' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own print files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'print-files' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'print-files' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 3. store-assets: drop broad public SELECT policy to prevent listing
-- Public URLs still work (public buckets bypass RLS for direct file access via CDN)
DROP POLICY IF EXISTS "Public read store assets" ON storage.objects;

-- 4. Realtime channel authorization: restrict topic subscriptions to matching order owner / store owner
-- Topics in use: order-<uuid>, order-pay-<uuid>, queue-<store_uid>
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized realtime topic access" ON realtime.messages;
CREATE POLICY "Authorized realtime topic access"
ON realtime.messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE realtime.topic() IN ('order-' || o.id::text, 'order-pay-' || o.id::text)
      AND o.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.stores s
    WHERE realtime.topic() = 'queue-' || s.store_uid
      AND s.owner_user_id = auth.uid()
  )
);
