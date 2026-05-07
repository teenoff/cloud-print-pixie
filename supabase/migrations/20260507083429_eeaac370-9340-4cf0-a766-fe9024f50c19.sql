REVOKE EXECUTE ON FUNCTION public.is_store_owner(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_store_owner(text) TO postgres, service_role;